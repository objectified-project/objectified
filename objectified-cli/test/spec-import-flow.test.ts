import { describe, expect, it, vi } from "vitest";

import {
  formatSpecImportPollLine,
  pollSpecImportUntilGate,
  pollSpecImportUntilTerminal,
} from "../src/lib/import/spec-import-flow.js";

describe("spec-import-flow", () => {
  it("formatSpecImportPollLine includes state, progress, and last event code", () => {
    const line = formatSpecImportPollLine(2, {
      job_id: "job-1",
      state: "running",
      percent: 50,
      progress: {
        phase: "creating-classes",
        total: 10,
        completed: 4,
        current_item: "Temperature",
      },
      events: [
        {
          id: "e1",
          ts: 1,
          level: "info",
          code: "CLASS_CREATED",
          message: "Imported class Temperature",
        },
      ],
    });
    expect(line).toContain("poll #2");
    expect(line).toContain("state=running");
    expect(line).toContain("percent=50");
    expect(line).toContain("phase=creating-classes");
    expect(line).toContain("step=4/10");
    expect(line).toContain("item=Temperature");
    expect(line).toContain("last_event=CLASS_CREATED");
  });

  it("pollSpecImportUntilGate invokes log once when first GET already completes", async () => {
    const getSpecImportStatus = vi.fn(async () => ({
      job_id: "j",
      state: "completed" as const,
      percent: 100,
    }));
    const lines: string[] = [];
    const st = await pollSpecImportUntilGate({
      api: { getSpecImportStatus },
      tenantSlug: "acme",
      jobId: "j",
      log: (line) => lines.push(line),
    });
    expect(st.state).toBe("completed");
    expect(lines).toEqual([expect.stringMatching(/^poll #0 state=completed/)]);
    expect(getSpecImportStatus).toHaveBeenCalledTimes(1);
  });

  it("pollSpecImportUntilTerminal stops on rolled-back", async () => {
    const getSpecImportStatus = vi.fn(async () => ({
      job_id: "j",
      state: "rolled-back" as const,
      percent: 0,
    }));
    const st = await pollSpecImportUntilTerminal({
      api: { getSpecImportStatus },
      tenantSlug: "acme",
      jobId: "j",
    });
    expect(st.state).toBe("rolled-back");
    expect(getSpecImportStatus).toHaveBeenCalledTimes(1);
  });
});
