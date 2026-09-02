/**
 * Recovery helpers for a deployed app whose lazy route chunk is stale or
 * temporarily unavailable.
 *
 * The recovery URL only bypasses the HTTP cache for the app shell. It does
 * not touch localStorage, IndexedDB, Supabase auth, or application data.
 */

export const CHUNK_RECOVERY_PARAM = "_ape_chunk_recovery";

export function chunkRetryStorageKey(buildId: string, pathname: string): string {
  return `ape:chunk-retry:${buildId}:${pathname}`;
}

export function createFreshAppShellUrl(currentHref: string, nonce = Date.now()): string {
  const url = new URL(currentHref);
  url.searchParams.set(CHUNK_RECOVERY_PARAM, String(nonce));
  return url.toString();
}

/** Claim the one automatic recovery attempt for this build and route. */
export function claimChunkRetry(
  buildId: string,
  pathname: string,
  storage: Pick<Storage, "getItem" | "setItem"> | null,
): boolean {
  if (!storage) return false;

  const key = chunkRetryStorageKey(buildId, pathname);
  try {
    if (storage.getItem(key)) return false;
    storage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

/** Force a fresh document request without clearing any user data. */
export function reloadWithFreshAppShell(): boolean {
  if (typeof window === "undefined" || !window.location?.href) return false;

  try {
    window.location.replace(createFreshAppShellUrl(window.location.href));
    return true;
  } catch {
    return false;
  }
}
