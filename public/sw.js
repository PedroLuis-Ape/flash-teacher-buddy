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
        // Take control immediately so any open clients see the unregister
        if (self.clients && typeof self.clients.claim === "function") {
          await self.clients.claim();
        }
        const clientsList = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of clientsList) {
          if ("navigate" in client) {
            client.navigate(client.url);
          }
        }
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
