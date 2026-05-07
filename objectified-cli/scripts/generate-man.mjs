#!/usr/bin/env node
/**
 * Writes troff man pages under man/man1 from oclif Help output (stripAnsi).
 * Updates package.json "man" array to match generated files.
 */

import { Config, loadHelpClass } from "@oclif/core";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manDir = join(root, "man", "man1");

function escapeMan(text) {
  return text
    .split("\n")
    .map((line) => {
      const escaped = line.replace(/\\/g, "\\\\");
      if (escaped.startsWith(".") || escaped.startsWith("'")) return `\\&${escaped}`;
      return escaped;
    })
    .join("\n");
}

function manFileBase(commandId, topicSeparator) {
  if (!commandId) return "objectified";
  const spaced = commandId.replace(/:/g, topicSeparator);
  return `objectified-${spaced.replace(/\s+/g, "-")}`;
}

function manTitle(baseName) {
  return baseName.replace(/-/g, "\\-").toUpperCase();
}

function writeManPage({ base, title, nameLine, body }) {
  const escaped = escapeMan(body.trimEnd());
  const page = `.TH ${title} 1 "" "" "User Commands"
.SH NAME
${nameLine}
.SH DESCRIPTION
.nf
${escaped}
.fi
`;
  writeFileSync(join(manDir, `${base}.1`), page, "utf8");
}

async function main() {
  rmSync(manDir, { recursive: true, force: true });
  mkdirSync(manDir, { recursive: true });

  const config = await Config.load(root);
  await config.load();

  const HelpClass = await loadHelpClass(config);
  const help = new HelpClass(config, { stripAnsi: true, maxWidth: 78 });
  const renderTemplate = (value) => {
    if (!value) return undefined;
    const rendered = help.render(value);
    return rendered.replace(/<%[^%]*%>/g, "").trim();
  };

  const topicSep = config.topicSeparator ?? " ";

  const rootBody = help.formatRoot();
  writeManPage({
    base: "objectified",
    title: "OBJECTIFIED",
    nameLine: `${config.bin} \\- ${config.pjson.description ?? "Objectified CLI"}`,
    body: rootBody,
  });

  const commands = config.commands.filter((c) => !c.hidden && c.pluginType === "core");
  for (const c of commands) {
    const cmd = { ...c, aliases: c.aliases ? [...c.aliases] : c.aliases };
    const displayId = cmd.id.replace(/:/g, topicSep);
    const summaryLine =
      (renderTemplate(cmd.summary)?.split("\n")[0]) ||
      (renderTemplate(cmd.description)?.split("\n")[0]) ||
      displayId;
    const body = help.formatCommand(cmd);
    const base = manFileBase(cmd.id, topicSep);
    writeManPage({
      base,
      title: manTitle(base),
      nameLine: `${config.bin} ${displayId} \\- ${summaryLine}`,
      body,
    });
  }

  const generated = readdirSync(manDir)
    .filter((f) => f.endsWith(".1"))
    .sort()
    .map((f) => `./man/man1/${f}`);

  const pkgPath = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.man = generated;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

await main();
