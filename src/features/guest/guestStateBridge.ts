/**
 * Ponte de continuidade visitante -> conta (Fase 3).
 *
 * O visitante grava preset e retomada no escopo `anon` (mesmo motor do app).
 * Ao entrar, este modulo copia esse estado para o escopo do usuario — nunca
 * sobrescrevendo o que ja existe na conta — e limpa o escopo `anon` para que
 * a pergunta nao reapareca.
 *
 * Regra de conflito escolhida: pergunta unica; sem resposta o dispositivo
 * vence; depois disso o remoto e autoritativo.
 */

export const GUEST_SCOPE = "anon";

const PRESET_PREFIX = "studyPreferences:v4:";
const RESUME_PREFIX = "ape_state_study_resume:v2:";
const DECISION_PREFIX = "ape:guest-merge:v1:";

export type GuestMergeDecision = "device" | "account";

export interface GuestStorageLike {
  length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface GuestStateSnapshot {
  presetKeys: string[];
  resumeKey: string | null;
}

function defaultStorage(): GuestStorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function allKeys(storage: GuestStorageLike): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key) keys.push(key);
  }
  return keys;
}

export function collectGuestState(storage: GuestStorageLike | null = defaultStorage()): GuestStateSnapshot {
  if (!storage) return { presetKeys: [], resumeKey: null };
  const keys = allKeys(storage);
  return {
    presetKeys: keys.filter((key) => key.startsWith(`${PRESET_PREFIX}${GUEST_SCOPE}:`)),
    resumeKey: keys.find((key) => key === `${RESUME_PREFIX}${GUEST_SCOPE}`) ?? null,
  };
}

export function hasGuestState(storage: GuestStorageLike | null = defaultStorage()): boolean {
  const snapshot = collectGuestState(storage);
  return snapshot.presetKeys.length > 0 || snapshot.resumeKey !== null;
}

export function guestScopedKeyForUser(userId: string, guestKey: string): string {
  return guestKey.replace(`${PRESET_PREFIX}${GUEST_SCOPE}:`, `${PRESET_PREFIX}${userId}:`);
}

export function readGuestMergeDecision(
  userId: string,
  storage: GuestStorageLike | null = defaultStorage(),
): GuestMergeDecision | null {
  if (!storage) return null;
  const raw = storage.getItem(`${DECISION_PREFIX}${userId}`);
  return raw === "device" || raw === "account" ? raw : null;
}

export function markGuestMergeDecision(
  userId: string,
  decision: GuestMergeDecision,
  storage: GuestStorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(`${DECISION_PREFIX}${userId}`, decision);
  } catch {
    // Storage pode estar indisponivel; a decisao simplesmente nao persiste.
  }
}

export interface GuestImportResult {
  importedPresets: number;
  importedResume: boolean;
  skippedExisting: string[];
}

/**
 * Copia o estado do visitante para o escopo do usuario.
 * Nunca sobrescreve chave existente da conta (sem duplicar nem reverter escolha).
 */
export function importGuestStateToAccount(
  userId: string,
  storage: GuestStorageLike | null = defaultStorage(),
): GuestImportResult {
  const result: GuestImportResult = { importedPresets: 0, importedResume: false, skippedExisting: [] };
  if (!storage) return result;

  const snapshot = collectGuestState(storage);
  for (const guestKey of snapshot.presetKeys) {
    const targetKey = guestScopedKeyForUser(userId, guestKey);
    const value = storage.getItem(guestKey);
    if (value === null) continue;
    if (storage.getItem(targetKey) !== null) {
      result.skippedExisting.push(targetKey);
    } else {
      storage.setItem(targetKey, value);
      result.importedPresets += 1;
    }
    storage.removeItem(guestKey);
  }

  if (snapshot.resumeKey) {
    const value = storage.getItem(snapshot.resumeKey);
    const targetKey = `${RESUME_PREFIX}${userId}`;
    if (value !== null && storage.getItem(targetKey) === null) {
      storage.setItem(targetKey, value);
      result.importedResume = true;
    }
    storage.removeItem(snapshot.resumeKey);
  }

  return result;
}

/** Conta vence: descarta o estado local do visitante. */
export function discardGuestState(storage: GuestStorageLike | null = defaultStorage()): void {
  if (!storage) return;
  const snapshot = collectGuestState(storage);
  for (const key of snapshot.presetKeys) storage.removeItem(key);
  if (snapshot.resumeKey) storage.removeItem(snapshot.resumeKey);
}

