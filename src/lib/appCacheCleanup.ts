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
] as const;

const LEGACY_WORKER_PATHS = new Set([
  "/sw.js",
  "/service-worker.js",
  "/serviceworker.js",
]);

export interface CacheStorageLike {
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}

export interface ServiceWorkerRegistrationLike {
  active?: { scriptURL?: string } | null;
  installing?: { scriptURL?: string } | null;
  waiting?: { scriptURL?: string } | null;
  unregister(): Promise<boolean>;
}

export interface ServiceWorkerContainerLike {
  getRegistrations(): Promise<ServiceWorkerRegistrationLike[]>;
}

export function isAppOwnedCacheName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return APP_CACHE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function registrationScriptUrl(registration: ServiceWorkerRegistrationLike): string {
  return registration.active?.scriptURL
    || registration.waiting?.scriptURL
    || registration.installing?.scriptURL
    || "";
}

export function isLegacyAppServiceWorkerScript(
  scriptUrl: string,
  expectedOrigin?: string,
): boolean {
  if (!scriptUrl) return false;

  try {
    const fallbackOrigin = expectedOrigin
      || (typeof window !== "undefined" ? window.location.origin : "https://app.invalid");
    const parsed = new URL(scriptUrl, fallbackOrigin);
    if (expectedOrigin && parsed.origin !== expectedOrigin) return false;

    const pathname = parsed.pathname.toLowerCase();
    return LEGACY_WORKER_PATHS.has(pathname)
      || pathname.includes("/workbox-")
      || pathname.includes("/vite-pwa-");
  } catch {
    return false;
  }
}

export async function cleanupAppOwnedCaches(
  cacheStorage?: CacheStorageLike,
): Promise<string[]> {
  const storage = cacheStorage
    ?? (typeof caches !== "undefined" ? caches : undefined);
  if (!storage) return [];

  const names = await storage.keys();
  const owned = names.filter(isAppOwnedCacheName);
  await Promise.allSettled(owned.map((name) => storage.delete(name)));
  return owned;
}

export async function unregisterLegacyAppServiceWorkers(
  container?: ServiceWorkerContainerLike,
  expectedOrigin?: string,
): Promise<string[]> {
  const serviceWorkerContainer = container
    ?? (typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? navigator.serviceWorker
      : undefined);
  if (!serviceWorkerContainer) return [];

  const origin = expectedOrigin
    ?? (typeof window !== "undefined" ? window.location.origin : undefined);
  const registrations = await serviceWorkerContainer.getRegistrations();
  const owned = registrations.filter((registration) =>
    isLegacyAppServiceWorkerScript(registrationScriptUrl(registration), origin),
  );

  await Promise.allSettled(owned.map((registration) => registration.unregister()));
  return owned.map(registrationScriptUrl);
}
