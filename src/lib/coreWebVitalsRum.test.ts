import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classifyCoreWebVital,
  getRumDeviceClass,
  getRumNavigationType,
  normalizeRumRoute,
  resolveRumSampleRate,
  resolveSessionSample,
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

  it("samples only on the canonical production host", () => {
    expect(resolveRumSampleRate(undefined, "www.apeeducation.org", true)).toBe(0.1);
    expect(resolveRumSampleRate("0.25", "www.apeeducation.org", true)).toBe(0.25);
    expect(resolveRumSampleRate("2", "www.apeeducation.org", true)).toBe(1);
    expect(resolveRumSampleRate("0.25", "deploy-preview.netlify.app", true)).toBe(0);
    expect(resolveRumSampleRate("0.25", "www.apeeducation.org", false)).toBe(0);
  });

  it("keeps one sampling decision per session and rate", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(resolveSessionSample(0, storage)).toBe(false);
    expect(resolveSessionSample(1, storage)).toBe(true);
    const sampled = resolveSessionSample(0.5, storage);
    expect(resolveSessionSample(0.5, storage)).toBe(sampled);
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

  it("does not add account, email, query or raw URL fields", () => {
    const client = readFileSync("src/lib/coreWebVitalsRum.ts", "utf8");
    const edge = readFileSync("netlify/edge-functions/rum-web-vital.js", "utf8");
    const migration = readFileSync("supabase/migrations/20260713160000_core_web_vitals_rum.sql", "utf8");
    const combined = `${client}\n${edge}\n${migration}`;

    expect(edge).toContain("ALLOWED_KEYS");
    expect(edge).not.toMatch(/userId|user_id|email|rawUrl|raw_url/);
    expect(migration).not.toMatch(/user_id|email|ip_address|user_agent/);
    expect(client).toContain("normalizeRumRoute");
    expect(combined).not.toContain("location.search");
  });
});
