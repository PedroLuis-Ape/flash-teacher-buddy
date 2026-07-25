/**
 * Persistence for MasterySessionState so that mastery rounds survive refresh.
 * Stored per-scope alongside the ordinary study snapshot key (with a suffix).
 * The database session remains authoritative; this is a client-side fallback
 * mirroring the pattern in studySessionSnapshot.ts.
 */
import type { MasterySessionState } from "./studySessionFlow";

const SUFFIX = ":mastery";

export function buildMasterySnapshotKey(baseKey: string): string {
  return `${baseKey}${SUFFIX}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every(
    (v) => typeof v === "number" && Number.isFinite(v),
  );
}

export function sanitizeMasterySnapshot(
  value: unknown,
  availableCardIds: Set<string>,
): MasterySessionState | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<MasterySessionState>;
  if (
    typeof row.totalEligible !== "number"
    || typeof row.roundSize !== "number"
    || typeof row.shuffle !== "boolean"
    || typeof row.roundNumber !== "number"
    || typeof row.currentRoundIndex !== "number"
    || !isStringArray(row.currentRoundIds)
    || !isStringArray(row.unseenIds)
    || !isStringArray(row.retryIds)
    || !isStringArray(row.masteredIds)
    || !isStringArray(row.correctThisRoundIds)
    || !isStringArray(row.failedThisRoundIds)
    || !isStringArray(row.reviewSourceThisRound)
    || !isNumberRecord(row.attemptsByCard)
    || !isNumberRecord(row.mistakesByCard)
  ) {
    return null;
  }

  const filterIds = (ids: string[]) => ids.filter((id) => availableCardIds.has(id));
  const currentRoundIds = filterIds(row.currentRoundIds);
  if (currentRoundIds.length === 0) return null;

  // Every card referenced in the snapshot must still exist in the eligible set,
  // and the union of currentRound + unseen + retry + mastered must equal the
  // deck. If the deck changed (add/remove card), we discard the snapshot so
  // the engine rebuilds from scratch.
  const unseenIds = filterIds(row.unseenIds);
  const retryIds = filterIds(row.retryIds);
  const masteredIds = filterIds(row.masteredIds);
  const union = new Set<string>([
    ...currentRoundIds,
    ...unseenIds,
    ...retryIds,
    ...masteredIds,
  ]);
  if (union.size !== availableCardIds.size) return null;
  for (const id of availableCardIds) {
    if (!union.has(id)) return null;
  }

  return {
    totalEligible: row.totalEligible,
    roundSize: row.roundSize,
    shuffle: row.shuffle,
    roundNumber: row.roundNumber,
    currentRoundIds,
    currentRoundIndex: Math.min(Math.max(row.currentRoundIndex, 0), currentRoundIds.length - 1),
    unseenIds,
    retryIds,
    masteredIds,
    attemptsByCard: row.attemptsByCard,
    mistakesByCard: row.mistakesByCard,
    correctThisRoundIds: filterIds(row.correctThisRoundIds),
    failedThisRoundIds: filterIds(row.failedThisRoundIds),
    reviewSourceThisRound: filterIds(row.reviewSourceThisRound),
  };
}

export function readMasterySnapshot(
  key: string,
  availableCardIds: Set<string>,
): MasterySessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? sanitizeMasterySnapshot(JSON.parse(raw), availableCardIds) : null;
  } catch {
    return null;
  }
}

export function writeMasterySnapshot(key: string, state: MasterySessionState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Storage is best-effort; DB session remains authoritative.
  }
}

export function clearMasterySnapshot(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}