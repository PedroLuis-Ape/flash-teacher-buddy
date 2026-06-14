import { describe, it, expect, beforeEach } from "vitest";
import {
  __testing__,
  recordRuntimePerf,
  markRuntime,
  measureRuntime,
  getRuntimePerfSnapshot,
  installRuntimePerformance,
  clearRuntimePerf,
} from "@/lib/runtimePerformance";

describe("runtimePerformance", () => {
  beforeEach(() => {
    __testing__.reset();
  });

  it("records a custom entry", () => {
    recordRuntimePerf({ kind: "stall_suspected", label: "test", duration: 12 });
    const snap = getRuntimePerfSnapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0].kind).toBe("stall_suspected");
    expect(snap[0].label).toBe("test");
    expect(snap[0].duration).toBe(12);
  });

  it("caps buffer at 50 entries", () => {
    for (let i = 0; i < 80; i++) {
      recordRuntimePerf({ kind: "mark", label: `m${i}` });
    }
    const snap = getRuntimePerfSnapshot();
    expect(snap).toHaveLength(50);
    // FIFO eviction: oldest 30 should be gone
    expect(snap[0].label).toBe("m30");
    expect(snap[snap.length - 1].label).toBe("m79");
  });

  it("clears the buffer", () => {
    recordRuntimePerf({ kind: "mark", label: "a" });
    clearRuntimePerf();
    expect(getRuntimePerfSnapshot()).toHaveLength(0);
  });

  it("marks and measures without throwing", () => {
    markRuntime("phase-start");
    markRuntime("phase-end");
    measureRuntime("phase", "phase-start", "phase-end");
    const snap = getRuntimePerfSnapshot();
    const kinds = snap.map((e) => e.kind);
    expect(kinds).toContain("mark");
    expect(kinds).toContain("measure");
  });

  it("installRuntimePerformance is idempotent", () => {
    // In a non-DOM environment the installer is a deliberate no-op; only
    // exercise the full idempotency contract when a window exists.
    if (typeof window === "undefined") {
      const teardown = installRuntimePerformance({ buildId: "test-1" });
      expect(__testing__.isInstalled()).toBe(false);
      teardown();
      return;
    }
    const teardown1 = installRuntimePerformance({ buildId: "test-1" });
    expect(__testing__.isInstalled()).toBe(true);
    const teardown2 = installRuntimePerformance({ buildId: "test-2" });
    teardown2();
    expect(__testing__.isInstalled()).toBe(true);
    teardown1();
    expect(__testing__.isInstalled()).toBe(false);
  });
});
