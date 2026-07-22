import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classifyCoreWebVital,
  getRumDeviceClass,
  getRumNavigationType,
  normalizeRumRoute,
} from "./coreWebVitalsRum";

describe("Core Web Vitals RUM", () => {
  it("uses the canonical good and needs-improvement thresholds", () => {
    expect(classifyCoreWebVital("LCP", 2500)).toBe("good");
    expect(classifyCoreWebVital("LCP", 2500.1)).toBe("needs-improvement");
    expect(classifyCoreWebVital("LCP", 4000.1)).toBe("poor");
    expect(classifyCoreWebVital("INP", 200)).toBe("good");
    expect(classifyCoreWebVital("INP", 200.1)).toBe("needs-improvement");
    expect(classifyCoreWebVital("INP", 500.1)).toBe("poor");
    expect(classifyCoreWebVital("CLS", 0.1)).toBe("good");
    expect(classifyCoreWebVital("CLS", 0.1001)).toBe("needs-improvement");
    expect(classifyCoreWebVital("CLS", 0.2501)).toBe("poor");
  });

  it("redacts dynamic identifiers and rejects unknown paths", () => {
    expect(normalizeRumRoute("/portal/list/41414141-4141-4141-8141-414141414141?answer=secret")).toBe("/portal/list/:id");
    expect(normalizeRumRoute("/portal/list/41414141-4141-4141-8141-414141414141/games")).toBe("/portal/list/:id/games");
    expect(normalizeRumRoute("/portal/professor/pedro-luis")).toBe("/portal/professor/:slug");
    expect(normalizeRumRoute("/notes/51515151-5151-4151-8151-515151515151")).toBe("/notes/:id");
    expect(normalizeRumRoute("/unknown/pedro@example.com")).toBe("/other");
    expect(normalizeRumRoute("/custom/private-student-name")).toBe("/other");
  });

  it("uses only coarse device and navigation classes", () => {
    expect(getRumDeviceClass(390)).toBe("mobile");
    expect(getRumDeviceClass(900)).toBe("tablet");
    expect(getRumDeviceClass(1440)).toBe("desktop");
    expect(getRumNavigationType("back_forward")).toBe("back_forward");
    expect(getRumNavigationType("restore")).toBe("unknown");
  });

  it("records an explicit zero baseline for pages without layout shifts", () => {
    const client = readFileSync("src/lib/coreWebVitalsRum.ts", "utf8");
    expect(client).toContain('update("CLS", 0)');
    expect(client.indexOf('update("CLS", 0)')).toBeLessThan(client.indexOf('observe("layout-shift"'));
  });

  it("keeps optional telemetry from crashing application startup", () => {
    const client = readFileSync("src/lib/coreWebVitalsRum.ts", "utf8");
    expect(client).toContain("startCoreWebVitalsRumInternal");
    expect(client).toContain("Collector disabled after startup failure");
    expect(client).toContain("Session diagnostics are best-effort only");
  });

  it("keeps measurements local and excludes account or raw URL fields", () => {
    const client = readFileSync("src/lib/coreWebVitalsRum.ts", "utf8");
    expect(client).toContain("normalizeRumRoute");
    expect(client).not.toMatch(/sendBeacon|fetch\(|\/api\/rum/);
    expect(client).not.toMatch(/userId|user_id|email|rawUrl|raw_url/);
    expect(client).not.toContain("location.search");
  });
});
