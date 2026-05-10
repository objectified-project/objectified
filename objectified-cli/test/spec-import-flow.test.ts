import { describe, expect, it, vi } from "vitest";

import {
  clampSpecImportPollIntervalMs,
  DEFAULT_SPEC_IMPORT_POLL_INTERVAL_MS,
  formatSpecImportPollLine,
  pollSpecImportUntilGate,
  pollSpecImportUntilTerminal,
} from "../src/lib/import/spec-import-flow.js";

describe("spec-import-flow", () => {
  it("clampSpecImportPollIntervalMs enforces min/max", () => {
    expect(clampSpecImportPollIntervalMs(1)).toBe(50);
    expect(clampSpecImportPollIntervalMs(999_999)).toBe(120_000);
    expect(clampSpecImportPollIntervalMs(400)).toBe(400);
  });

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

  it("pollSpecImportUntilGate waits a fixed pollIntervalMs between running and completed", async () => {
    vi.useFakeTimers();
    const getSpecImportStatus = vi
      .fn()
      .mockResolvedValueOnce({
        job_id: "j",
        state: "running" as const,
        percent: 10,
      })
      .mockResolvedValueOnce({
        job_id: "j",
        state: "completed" as const,
        percent: 100,
      });
    const promise = pollSpecImportUntilGate({
      api: { getSpecImportStatus },
      tenantSlug: "acme",
      jobId: "j",
      pollIntervalMs: 1000,
    });
    await Promise.resolve();
    expect(getSpecImportStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    await Promise.resolve();
    expect(getSpecImportStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(getSpecImportStatus).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("pollSpecImportUntilGate uses the same interval on every wait", async () => {
    vi.useFakeTimers();
    const getSpecImportStatus = vi
      .fn()
      .mockResolvedValueOnce({ job_id: "j", state: "running" as const, percent: 10 })
      .mockResolvedValueOnce({ job_id: "j", state: "running" as const, percent: 50 })
      .mockResolvedValueOnce({ job_id: "j", state: "completed" as const, percent: 100 });
    const promise = pollSpecImportUntilGate({
      api: { getSpecImportStatus },
      tenantSlug: "acme",
      jobId: "j",
      pollIntervalMs: 500,
    });
    await Promise.resolve();
    expect(getSpecImportStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();
    expect(getSpecImportStatus).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(500);
    await promise;
    expect(getSpecImportStatus).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
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

  it("pollSpecImportUntilGate defaults to DEFAULT_SPEC_IMPORT_POLL_INTERVAL_MS when pollIntervalMs omitted", async () => {
    vi.useFakeTimers();
    const getSpecImportStatus = vi
      .fn()
      .mockResolvedValueOnce({ job_id: "j", state: "running" as const, percent: 1 })
      .mockResolvedValueOnce({ job_id: "j", state: "completed" as const, percent: 100 });
    const promise = pollSpecImportUntilGate({
      api: { getSpecImportStatus },
      tenantSlug: "acme",
      jobId: "j",
    });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(DEFAULT_SPEC_IMPORT_POLL_INTERVAL_MS - 1);
    await Promise.resolve();
    expect(getSpecImportStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(getSpecImportStatus).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
