/**
 * @deprecated Não há mais espera artificial antes do áudio de entrada do Flip.
 * Mantido em 0 apenas para compatibilidade de importações antigas.
 */
export const FLIP_ENTRY_AUDIO_DELAY_MS = 0;

const STORAGE_KEY = "ape:study:flip-entry-audio:v1";

export function readFlipEntryAudioPreference(): boolean {
  if (typeof window === "undefined") return true;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return true;
    return stored === "true";
  } catch {
    return true;
  }
}

export function writeFlipEntryAudioPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}
