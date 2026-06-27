/*
 * APE legacy PWA reset worker.
 *
 * This file intentionally does not cache anything. It replaces older workers,
 * clears their Cache Storage entries, refreshes open app windows once and then
 * unregisters itself. Keep the filename stable so installed apps can update it.
 */

const RESET_VERSION = "2026-06-27-pwa-reset-1";
const RESET_PARAM = "_ape_pwa_reset";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.allSettled(names.map((name) => caches.delete(name)));
    } catch (error) {
      console.warn("[APE PWA Reset] Cache cleanup failed.", error);
    }

    try {
      await self.clients.claim();
    } catch (error) {
      console.warn("[APE PWA Reset] Client claim failed.", error);
    }

    try {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windows) {
        const target = new URL(client.url);
        if (target.origin !== self.location.origin) continue;

        if (target.searchParams.get(RESET_PARAM) !== RESET_VERSION) {
          target.searchParams.set(RESET_PARAM, RESET_VERSION);
          await client.navigate(target.href);
        } else {
          client.postMessage({ type: "APE_PWA_RESET_COMPLETE", version: RESET_VERSION });
        }
      }
    } catch (error) {
      console.warn("[APE PWA Reset] Client refresh failed.", error);
    }

    try {
      await self.registration.unregister();
    } catch (error) {
      console.warn("[APE PWA Reset] Worker unregister failed.", error);
    }
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request, { cache: "no-store" }).catch(() => fetch(event.request)),
  );
});
