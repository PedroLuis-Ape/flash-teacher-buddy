/**
 * Persistência local do modo de correção dos modos Escrever e Misto.
 * Cada modo usa sua própria chave para não sobrescrever o preset do outro.
 */

export type WriteCorrectionMode = "flexible" | "hard";
export type WriteCorrectionGameMode = "write" | "mixed";

export const WRITE_CORRECTION_MODE_STORAGE_KEY = "ape.writeCorrectionMode.v2";
export const LEGACY_WRITE_CORRECTION_MODE_STORAGE_KEY = "ape.writeCorrectionMode.v1";
export const DEFAULT_WRITE_CORRECTION_MODE: WriteCorrectionMode = "flexible";

function isValid(value: unknown): value is WriteCorrectionMode {
  return value === "flexible" || value === "hard";
}

function resolveGameMode(explicit?: string): WriteCorrectionGameMode {
  if (explicit === "mixed" || explicit === "write") return explicit;
  if (typeof window === "undefined") return "write";
  try {
    return new URLSearchParams(window.location.search).get("mode") === "mixed" ? "mixed" : "write";
  } catch {
    return "write";
  }
}

export function buildWriteCorrectionModeStorageKey(gameMode?: string): string {
  return `${WRITE_CORRECTION_MODE_STORAGE_KEY}:${resolveGameMode(gameMode)}`;
}

export function readWriteCorrectionMode(gameMode?: string): WriteCorrectionMode {
  if (typeof window === "undefined") return DEFAULT_WRITE_CORRECTION_MODE;
  try {
    const key = buildWriteCorrectionModeStorageKey(gameMode);
    const scoped = window.localStorage.getItem(key);
    if (isValid(scoped)) return scoped;

    const legacy = window.localStorage.getItem(LEGACY_WRITE_CORRECTION_MODE_STORAGE_KEY);
    if (isValid(legacy)) {
      window.localStorage.setItem(key, legacy);
      return legacy;
    }
    return DEFAULT_WRITE_CORRECTION_MODE;
  } catch {
    return DEFAULT_WRITE_CORRECTION_MODE;
  }
}

export function writeWriteCorrectionMode(mode: WriteCorrectionMode, gameMode?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(buildWriteCorrectionModeStorageKey(gameMode), mode);
    window.dispatchEvent(
      new CustomEvent("ape:writeCorrectionModeChanged", { detail: mode }),
    );
  } catch {
    // storage bloqueado — modo continua como default
  }
}
