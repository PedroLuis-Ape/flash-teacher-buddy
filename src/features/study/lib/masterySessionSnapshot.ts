/**
 * Persistence for MasterySessionState so that mastery rounds survive refresh.
 * Stored per-scope alongside the ordinary study snapshot key (with a suffix).
 * The database session remains authoritative; this is a client-side fallback
 * mirroring the pattern in studySessionSnapshot.ts.
 */
import type { MasterySessionState, StudyCardResult } from "./studySessionFlow";

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

function isResultRecord(value: unknown): value is Record<string, StudyCardResult> {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every((result) =>
    result === "correct" || result === "incorrect" || result === "skipped" || result === "revealed"
  );
}

export function sanitizeMasterySnapshot(
  value: unknown,
  availableCardIds: Set<string>,
): MasterySessionState | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<MasterySessionState>;
  if (
    row.version !== 2
    || (row.status !== "active" && row.status !== "round-complete" && row.status !== "journey-complete")
    || typeof row.totalEligible !== "number"
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
    || !isResultRecord(row.currentRoundResults)
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

  const currentRoundIndex = Math.min(Math.max(row.currentRoundIndex, 0), currentRoundIds.length);
  let status = row.status;
  if (status === "active" && currentRoundIndex >= currentRoundIds.length) {
    status = unseenIds.length === 0
      && retryIds.length === 0
      && filterIds(row.failedThisRoundIds).length === 0
      ? "journey-complete"
      : "round-complete";
  }

  const currentRoundSet = new Set(currentRoundIds);
  const currentRoundResults = Object.fromEntries(
    Object.entries(row.currentRoundResults).filter(([id]) => currentRoundSet.has(id)),
  ) as Record<string, StudyCardResult>;

  return {
    version: 2,
    totalEligible: row.totalEligible,
    roundSize: row.roundSize,
    shuffle: row.shuffle,
    status,
    roundNumber: row.roundNumber,
    currentRoundIds,
    currentRoundIndex,
    unseenIds,
    retryIds,
    masteredIds,
    attemptsByCard: row.attemptsByCard,
    mistakesByCard: row.mistakesByCard,
    correctThisRoundIds: filterIds(row.correctThisRoundIds),
    failedThisRoundIds: filterIds(row.failedThisRoundIds),
    reviewSourceThisRound: filterIds(row.reviewSourceThisRound),
    currentRoundResults,
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
