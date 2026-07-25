/**
 * Persistência local do modo de correção do modo Escrever.
 * Chave versionada em localStorage; não usa Supabase.
 */

export type WriteCorrectionMode = "flexible" | "hard";

export const WRITE_CORRECTION_MODE_STORAGE_KEY = "ape.writeCorrectionMode.v1";
export const DEFAULT_WRITE_CORRECTION_MODE: WriteCorrectionMode = "flexible";

function isValid(value: unknown): value is WriteCorrectionMode {
  return value === "flexible" || value === "hard";
}

export function readWriteCorrectionMode(): WriteCorrectionMode {
  if (typeof window === "undefined") return DEFAULT_WRITE_CORRECTION_MODE;
  try {
    const raw = window.localStorage.getItem(WRITE_CORRECTION_MODE_STORAGE_KEY);
    return isValid(raw) ? raw : DEFAULT_WRITE_CORRECTION_MODE;
  } catch {
    return DEFAULT_WRITE_CORRECTION_MODE;
  }
}

export function writeWriteCorrectionMode(mode: WriteCorrectionMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WRITE_CORRECTION_MODE_STORAGE_KEY, mode);
    window.dispatchEvent(
      new CustomEvent("ape:writeCorrectionModeChanged", { detail: mode }),
    );
  } catch {
    // storage bloqueado — modo continua como default
  }
}