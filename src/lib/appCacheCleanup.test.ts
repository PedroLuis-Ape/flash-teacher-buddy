import { describe, expect, it, vi } from "vitest";
import {
  cleanupAppOwnedCaches,
  isAppOwnedCacheName,
  isLegacyAppServiceWorkerScript,
  unregisterLegacyAppServiceWorkers,
} from "./appCacheCleanup";

describe("app cache cleanup policy", () => {
  it("recognizes only known app cache prefixes", () => {
    expect(isAppOwnedCacheName("ape-shell-v3")).toBe(true);
    expect(isAppOwnedCacheName("app-piteco-assets")).toBe(true);
    expect(isAppOwnedCacheName("workbox-precache-v2-https://apeeducation.org/")).toBe(true);
    expect(isAppOwnedCacheName("vite-pwa-runtime")).toBe(true);
    expect(isAppOwnedCacheName("firebase-messaging-store")).toBe(false);
    expect(isAppOwnedCacheName("third-party-cache")).toBe(false);
  });

  it("deletes app caches and preserves unknown caches", async () => {
    const deleted: string[] = [];
    const storage = {
      keys: vi.fn(async () => [
        "ape-shell-v3",
        "workbox-precache-v2-prod",
        "firebase-messaging-store",
      ]),
      delete: vi.fn(async (name: string) => {
        deleted.push(name);
        return true;
      }),
    };

    const result = await cleanupAppOwnedCaches(storage);
    expect(result).toEqual(["ape-shell-v3", "workbox-precache-v2-prod"]);
    expect(deleted).toEqual(["ape-shell-v3", "workbox-precache-v2-prod"]);
  });

  it("recognizes only same-origin legacy app workers", () => {
    const origin = "https://www.apeeducation.org";
    expect(isLegacyAppServiceWorkerScript(`${origin}/sw.js`, origin)).toBe(true);
    expect(isLegacyAppServiceWorkerScript(`${origin}/workbox-old.js`, origin)).toBe(true);
    expect(isLegacyAppServiceWorkerScript(`${origin}/push-worker.js`, origin)).toBe(false);
    expect(isLegacyAppServiceWorkerScript("https://other.example/sw.js", origin)).toBe(false);
  });

  it("unregisters only matching legacy workers", async () => {
    const unregisterApp = vi.fn(async () => true);
    const unregisterPush = vi.fn(async () => true);
    const container = {
      getRegistrations: vi.fn(async () => [
        { active: { scriptURL: "https://www.apeeducation.org/sw.js" }, unregister: unregisterApp },
        { active: { scriptURL: "https://www.apeeducation.org/push-worker.js" }, unregister: unregisterPush },
      ]),
    };

    const removed = await unregisterLegacyAppServiceWorkers(
      container,
      "https://www.apeeducation.org",
    );

    expect(removed).toEqual(["https://www.apeeducation.org/sw.js"]);
    expect(unregisterApp).toHaveBeenCalledTimes(1);
    expect(unregisterPush).not.toHaveBeenCalled();
  });
});
