const APP_CACHE_PREFIXES = [
  "ape-",
  "ape_",
  "app-piteco-",
  "app_piteco_",
  "piteco-",
  "piteco_",
  "vite-pwa-",
  "workbox-precache",
  "workbox-runtime",
];

function isAppOwnedCacheName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return APP_CACHE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const appCaches = cacheNames.filter(isAppOwnedCacheName);
        await Promise.all(appCaches.map((name) => caches.delete(name)));
        await self.registration.unregister();
        // Do not navigate clients automatically. The next natural reload
        // receives the fresh shell without risking a preview reload loop.
      } catch (error) {
        console.warn("[SW cleanup] Failed:", error);
      }
    })()
  );
});

self.addEventListener("fetch", () => {
  // Intentionally do nothing. Let the browser use the network normally.
});
