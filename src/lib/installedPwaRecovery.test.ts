import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const manifest = JSON.parse(read("public/manifest.webmanifest")) as {
  id: string;
  start_url: string;
  scope: string;
};
const headers = read("public/_headers");
const primaryWorker = read("public/sw.js");
const compatibilityWorker = read("public/service-worker.js");
const watchdog = read("src/lib/bootWatchdog.ts");
const runtime = read("src/integrations/supabase/platformRuntime.ts");

describe("installed PWA recovery", () => {
  it("keeps one install identity while versioning the launch URL", () => {
    expect(manifest.id).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.start_url).toContain("app_shell=20260627-reset1");
  });

  it.each([
    ["sw.js", primaryWorker],
    ["service-worker.js", compatibilityWorker],
  ])("turns %s into a self-removing cache reset worker", (_name, source) => {
    expect(source).toContain("self.skipWaiting()");
    expect(source).toContain("caches.keys()");
    expect(source).toContain("self.clients.claim()");
    expect(source).toContain("client.navigate");
    expect(source).toContain("self.registration.unregister()");
    expect(source).toContain('cache: "no-store"');
  });

  it("serves the app shell, manifest and reset workers without persistent caching", () => {
    expect(headers).toMatch(/\/\n\s+Cache-Control: no-cache, no-store, must-revalidate/);
    expect(headers).toMatch(/\/manifest\.webmanifest\n\s+Cache-Control: no-cache, no-store, must-revalidate/);
    expect(headers).toMatch(/\/sw\.js\n\s+Cache-Control: no-cache, no-store, must-revalidate/);
    expect(headers).toMatch(/\/service-worker\.js\n\s+Cache-Control: no-cache, no-store, must-revalidate/);
  });

  it("runs a new client-side cleanup cycle without hardcoding another backend", () => {
    expect(watchdog).toContain("2026-06-27-installed-pwa-reset-2");
    expect(runtime).not.toContain("ymahldldyxvwjeruaxpr");
    expect(runtime).not.toContain("LOVABLE_CLOUD_FALLBACK");
  });
});
