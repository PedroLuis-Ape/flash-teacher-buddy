const VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/pwa-192.png',
  '/icons/pwa-512.png',
  '/icons/pwa-maskable.png'
];

self.addEventListener('install', (e) => {
  console.log('[SW] Installing service worker...');
  e.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Activating service worker...');
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Apenas GET
  if (req.method !== 'GET') return;

  // Assets estáticos → Cache First
  if (url.origin === location.origin && url.pathname.match(/\.(?:js|css|png|webp|jpg|svg|woff2?)$/)) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) {
          console.log('[SW] Serving from cache:', url.pathname);
          return cached;
        }
        return fetch(req).then(res => {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(req, clone));
          return res;
        }).catch(() => caches.match('/offline.html'));
      })
    );
    return;
  }

  // Navegação SPA → Network First com fallback ao index.html e offline.html
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(async () => {
        console.log('[SW] Network failed, serving cached index or offline page');
        return (await caches.match('/')) || (await caches.match('/offline.html'));
      })
    );
    return;
  }

  // APIs/dados → Network First com cache de runtime
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && url.origin === location.origin) {
        const clone = res.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(req, clone));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
