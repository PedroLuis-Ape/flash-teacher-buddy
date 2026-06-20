const UPDATE_QUERY_PARAM = "__ape_update";

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("loading chunk") ||
    message.includes("loading css chunk") ||
    message.includes("dynamically imported module") ||
    error.name === "ChunkLoadError"
  );
}

export function getCurrentBuildId(): string {
  if (typeof __BUILD_TIMESTAMP__ !== "undefined" && __BUILD_TIMESTAMP__) {
    return __BUILD_TIMESTAMP__;
  }
  return "dev";
}

export function getChunkRetryKey(pathname: string, buildId = getCurrentBuildId()): string {
  return `chunkRetry:${buildId}:${pathname}`;
}

export function tryOneChunkRetry(error: unknown): boolean {
  if (!isChunkLoadError(error) || typeof window === "undefined") return false;

  try {
    const key = getChunkRetryKey(window.location.pathname);
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
    reloadForAppUpdate();
    return true;
  } catch {
    return false;
  }
}

export function reloadForAppUpdate(): void {
  if (typeof window === "undefined") return;

  try {
    const url = new URL(window.location.href);
    url.searchParams.set(UPDATE_QUERY_PARAM, Date.now().toString());
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

export function clearUpdateReloadParam(): void {
  if (typeof window === "undefined") return;

  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(UPDATE_QUERY_PARAM)) return;

    url.searchParams.delete(UPDATE_QUERY_PARAM);
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  } catch {
    // The temporary parameter is harmless if history replacement is unavailable.
  }
}
