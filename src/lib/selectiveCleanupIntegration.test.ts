import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const boot = readFileSync(new URL("./bootStability.ts", import.meta.url), "utf8");
const safeMode = readFileSync(new URL("../components/SafeMode.tsx", import.meta.url), "utf8");
const worker = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

describe("selective cleanup integration", () => {
  it("routes boot cleanup through the selective policy", () => {
    expect(boot).toContain("cleanupAppOwnedCaches");
    expect(boot).toContain("unregisterLegacyAppServiceWorkers");
    expect(boot).not.toContain("names.map((n) => caches.delete(n))");
    expect(boot).not.toContain("regs.map((r) => r.unregister())");
  });

  it("routes Safe Mode cleanup through the selective policy", () => {
    expect(safeMode).toContain("cleanupAppOwnedCaches");
    expect(safeMode).toContain("unregisterLegacyAppServiceWorkers");
    expect(safeMode).toContain("ape_outbox_");
    expect(safeMode).toContain("app-piteco:");
    expect(safeMode).not.toContain("localStorage.clear()");
  });

  it("keeps unknown caches out of the cleanup worker deletion list", () => {
    expect(worker).toContain("isAppOwnedCacheName");
    expect(worker).toContain("cacheNames.filter");
    expect(worker).not.toContain("cacheNames.map((name) => caches.delete(name))");
  });
});
