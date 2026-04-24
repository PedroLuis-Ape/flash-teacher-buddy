self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
        await self.registration.unregister();
        // IMPORTANT: do NOT auto-navigate clients here.
        // In iframe / Lovable preview contexts, calling client.navigate(url)
        // can trigger reload loops that prevent the app from ever booting.
        // Unregistering + clearing caches is enough — next natural reload
        // will load the fresh shell.
      } catch (error) {
        console.warn("[SW cleanup] Failed:", error);
      }
    })()
  );
});

self.addEventListener("fetch", () => {
  // Intentionally do nothing.
  // Let the browser use the network normally.
});
