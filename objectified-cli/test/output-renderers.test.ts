import { describe, expect, it } from "vitest";

import {
  createCliOutput,
  localePrefersAsciiTable,
  stableDeepSort,
  type CliOutputOptions,
} from "../src/lib/output.js";

function capture(
  overrides: Partial<CliOutputOptions>,
): { out: ReturnType<typeof createCliOutput>; stdout: () => string; stderr: () => string } {
  let stdoutBuf = "";
  let stderrBuf = "";
  const opts: CliOutputOptions = {
    json: false,
    color: false,
    quiet: false,
    stdoutIsTTY: false,
    stderrIsTTY: false,
    langAscii: false,
    stdoutWrite: (c) => {
      stdoutBuf += c;
    },
    stderrWrite: (c) => {
      stderrBuf += c;
    },
    ...overrides,
  };
  return {
    out: createCliOutput(opts),
    stdout: () => stdoutBuf,
    stderr: () => stderrBuf,
  };
}

const sampleColumns = [
  { key: "name", label: "Name" },
  { key: "id", label: "ID" },
];

const sampleRows = [
  { id: 2, name: "beta" },
  { id: 1, name: "alpha" },
];

describe("localePrefersAsciiTable", () => {
  it("detects C/POSIX locales", () => {
    expect(localePrefersAsciiTable({ LANG: "C" })).toBe(true);
    expect(localePrefersAsciiTable({ LANG: "POSIX" })).toBe(true);
    expect(localePrefersAsciiTable({ LANG: "C.UTF-8" })).toBe(true);
    expect(localePrefersAsciiTable({ LC_ALL: "C", LANG: "en_US.UTF-8" })).toBe(true);
  });

  it("returns false for typical UTF-8 locales", () => {
    expect(localePrefersAsciiTable({ LANG: "en_US.UTF-8" })).toBe(false);
    expect(localePrefersAsciiTable({})).toBe(false);
  });
});

describe("stableDeepSort", () => {
  it("sorts nested keys", () => {
    expect(stableDeepSort({ z: 1, a: { m: 2, b: 3 } })).toEqual({
      a: { b: 3, m: 2 },
      z: 1,
    });
  });
});

describe("createCliOutput snapshots", () => {
  it("table as TSV when stdout is not a TTY", () => {
    const { out, stdout, stderr } = capture({});
    out.table(sampleRows, sampleColumns);
    expect(stderr()).toBe("");
    expect(stdout()).toBe("Name\tID\nbeta\t2\nalpha\t1\n");
  });

  it("table as ANSI table when TTY + color + non-ASCII locale border allowed", () => {
    const { out, stdout, stderr } = capture({
      stdoutIsTTY: true,
      color: true,
      langAscii: false,
    });
    out.table(sampleRows, sampleColumns);
    expect(stderr()).toBe("");
    const s = stdout();
    expect(s).toContain("Name");
    expect(s).toContain("ID");
    expect(s).toContain("beta");
    expect(s).toContain("alpha");
    expect(s).toMatch(/┌[\s\S]*└[\s\S]*┘\n$/);
  });

  it("table uses ASCII borders when langAscii", () => {
    const { out, stdout, stderr } = capture({
      stdoutIsTTY: true,
      color: true,
      langAscii: true,
    });
    out.table(sampleRows, sampleColumns);
    expect(stderr()).toBe("");
    const s = stdout();
    expect(s).toContain("Name");
    expect(s).toContain("beta");
    expect(s).toMatch(/\+-+\+[\s\S]*\+-+\+\n$/);
  });

  it("table emits stable JSON when json mode", () => {
    const { out, stdout, stderr } = capture({ json: true });
    out.table(sampleRows, sampleColumns);
    expect(stderr()).toBe("");
    expect(stdout()).toBe('[{"id":2,"name":"beta"},{"id":1,"name":"alpha"}]\n');
  });

  it("json is compact when piped or quiet", () => {
    const piped = capture({ json: true, stdoutIsTTY: false });
    piped.out.json({ z: 1, a: { nested: true } });
    const quiet = capture({ json: true, stdoutIsTTY: true, quiet: true });
    quiet.out.json({ z: 1, a: { nested: true } });
    expect({ piped: piped.stdout(), quiet: quiet.stdout() }).toMatchSnapshot();
  });

  it("json is pretty with 2-space indent when TTY and not quiet", () => {
    const { out, stdout } = capture({ json: true, stdoutIsTTY: true, quiet: false });
    out.json({ z: 1, a: { nested: true } });
    expect(stdout()).toMatchSnapshot();
  });

  it("yaml writes sorted stable YAML when human stdout", () => {
    const { out, stdout } = capture({ stdoutIsTTY: true });
    out.yaml({ z: 1, b: [{ q: 2, a: 1 }] });
    expect(stdout()).toMatchSnapshot();
  });

  it("suppresses yaml under json or quiet", () => {
    const jsonMode = capture({ json: true, stdoutIsTTY: true });
    jsonMode.out.yaml({ a: 1 });
    const quietMode = capture({ quiet: true, stdoutIsTTY: true });
    quietMode.out.yaml({ a: 1 });
    expect({ jsonMode: jsonMode.stdout(), quietMode: quietMode.stdout() }).toEqual({
      jsonMode: "",
      quietMode: "",
    });
  });

  it("text and kv respect quiet and json", () => {
    const quiet = capture({ quiet: true, stdoutIsTTY: true });
    quiet.out.text("nope");
    quiet.out.kv({ a: 1 });
    const jsonMode = capture({ json: true, stdoutIsTTY: true });
    jsonMode.out.text("nope");
    jsonMode.out.kv({ a: 1 });
    expect({ quiet: quiet.stdout(), jsonMode: jsonMode.stdout() }).toEqual({
      quiet: "",
      jsonMode: "",
    });
  });

  it("kv writes aligned keys when human", () => {
    const { out, stdout } = capture({ stdoutIsTTY: true });
    out.kv({ short: "x", muchLongerKey: "y" });
    expect(stdout()).toMatchSnapshot();
  });

  it("warn and error go to stderr", () => {
    const { out, stdout, stderr } = capture({ color: false });
    out.warn("one");
    out.error("two");
    expect({ stdout: stdout(), stderr: stderr() }).toMatchSnapshot();
  });

  it("banner and hint hide when not TTY", () => {
    const { out, stdout } = capture({ stdoutIsTTY: false });
    out.banner("Title");
    out.hint("Tip");
    expect(stdout()).toBe("");
  });

  it("banner and hint show when TTY and human mode", () => {
    const { out, stdout } = capture({ stdoutIsTTY: true });
    out.banner("Title");
    out.hint("Tip");
    expect(stdout()).toMatchSnapshot();
  });

  it("spinner is silent when json, quiet, or non-TTY", () => {
    for (const overrides of [
      { json: true, stdoutIsTTY: true, stderrIsTTY: true },
      { quiet: true, stdoutIsTTY: true, stderrIsTTY: true },
      { stdoutIsTTY: false, stderrIsTTY: true },
      { stdoutIsTTY: true, stderrIsTTY: false },
    ] as const) {
      const { out } = capture({ stderrIsTTY: true, ...overrides });
      const spin = out.spinner("Working…");
      spin.start();
      spin.stop();
      expect(spin.isSilent).toBe(true);
    }
  });

  it("success line suppressed when quiet", () => {
    const { out, stdout } = capture({ quiet: true, stdoutIsTTY: true });
    out.success("Done.");
    expect(stdout()).toBe("");
  });
});
