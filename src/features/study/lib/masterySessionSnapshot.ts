/**
 * Persistence for MasterySessionState so that mastery rounds survive refresh.
 * Stored per-scope alongside the ordinary study snapshot key (with a suffix).
 * The database session remains authoritative; this is a client-side fallback
 * mirroring the pattern in studySessionSnapshot.ts.
 */
import { MASTERY_ROUND_SIZE, type MasterySessionState, type StudyCardResult } from "./studySessionFlow";

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
  const dedupeIds = (ids: string[]) => Array.from(new Set(ids));
  const currentRoundIds = dedupeIds(filterIds(row.currentRoundIds)).slice(0, MASTERY_ROUND_SIZE);
  if (currentRoundIds.length === 0) return null;

  // Legacy snapshots could contain the same card in the active round and in
  // unseen/retry queues. That made a recovered card look permanently pending
  // and could offer endless next rounds. Repair the queues into disjoint sets.
  const currentRoundSet = new Set(currentRoundIds);
  const masteredIds = dedupeIds(filterIds(row.masteredIds));
  const masteredSet = new Set(masteredIds);
  const unseenIds = dedupeIds(filterIds(row.unseenIds)).filter(
    (id) => !currentRoundSet.has(id) && !masteredSet.has(id),
  );
  const unseenSet = new Set(unseenIds);
  const retryIds = dedupeIds(filterIds(row.retryIds)).filter(
    (id) => !currentRoundSet.has(id) && !masteredSet.has(id) && !unseenSet.has(id),
  );

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

  const failedThisRoundIds = dedupeIds(filterIds(row.failedThisRoundIds)).filter(
    (id) => currentRoundSet.has(id) && !masteredSet.has(id),
  );
  const currentRoundIndex = Math.min(Math.max(row.currentRoundIndex, 0), currentRoundIds.length);
  let status = row.status;
  if (currentRoundIndex < currentRoundIds.length) {
    status = "active";
  } else {
    status = unseenIds.length === 0
      && retryIds.length === 0
      && failedThisRoundIds.length === 0
      ? "journey-complete"
      : "round-complete";
  }

  const currentRoundResults = Object.fromEntries(
    Object.entries(row.currentRoundResults).filter(([id]) => currentRoundSet.has(id)),
  ) as Record<string, StudyCardResult>;

  return {
    version: 2,
    totalEligible: availableCardIds.size,
    roundSize: MASTERY_ROUND_SIZE,
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
    failedThisRoundIds,
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
