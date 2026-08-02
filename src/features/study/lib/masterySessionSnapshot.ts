/**
 * Persistence for MasterySessionState so that mastery rounds survive refresh.
 * Stored per-scope alongside the ordinary study snapshot key (with a suffix).
 * The database session remains authoritative; this is a client-side fallback
 * mirroring the pattern in studySessionSnapshot.ts.
 */
import {
  MASTERY_ROUND_SIZE,
  type MasterySessionState,
  type StudyCardResult,
  validateMasterySessionState,
} from "./studySessionFlow";

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
    result === "correct"
    || result === "correct-repeat"
    || result === "incorrect"
    || result === "skipped"
    || result === "revealed"
  );
}

function isCorrectResult(result: StudyCardResult | undefined): boolean {
  return result === "correct" || result === "correct-repeat";
}

function mustReturnNextRound(result: StudyCardResult | undefined): boolean {
  return result === "correct-repeat"
    || result === "incorrect"
    || result === "skipped"
    || result === "revealed";
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

  const currentRoundSet = new Set(currentRoundIds);
  const currentRoundResults = Object.fromEntries(
    Object.entries(row.currentRoundResults).filter(([id]) => currentRoundSet.has(id)),
  ) as Record<string, StudyCardResult>;

  // Legacy snapshots could contain the same card in the active round and in
  // unseen/retry queues. That made a recovered card look permanently pending
  // and could offer endless next rounds. Repair the queues into disjoint sets.
  // A current card is allowed to remain in masteredIds only when this snapshot
  // proves it was answered correctly without a manual repeat request.
  const masteredIds = dedupeIds([
    ...filterIds(row.masteredIds),
    ...currentRoundIds.filter((id) => currentRoundResults[id] === "correct"),
  ]).filter(
    (id) => !currentRoundSet.has(id) || currentRoundResults[id] === "correct",
  );
  const masteredSet = new Set(masteredIds);
  const knownIds = new Set([
    ...row.currentRoundIds,
    ...row.unseenIds,
    ...row.retryIds,
    ...row.masteredIds,
  ]);
  const newlyAvailableIds = Array.from(availableCardIds).filter((id) => !knownIds.has(id));
  const unseenIds = dedupeIds(filterIds([...row.unseenIds, ...newlyAvailableIds])).filter(
    (id) => !currentRoundSet.has(id) && !masteredSet.has(id),
  );
  const unseenSet = new Set(unseenIds);
  const retryIds = dedupeIds(filterIds(row.retryIds)).filter(
    (id) => !currentRoundSet.has(id) && !masteredSet.has(id) && !unseenSet.has(id),
  );

  const currentRoundIndex = Math.min(Math.max(Math.floor(row.currentRoundIndex), 0), currentRoundIds.length);
  const unresolvedCurrentIds = currentRoundIndex >= currentRoundIds.length
    ? currentRoundIds.filter((id) => !currentRoundResults[id])
    : [];
  const failedThisRoundIds = dedupeIds([
    ...filterIds(row.failedThisRoundIds),
    ...currentRoundIds.filter((id) => mustReturnNextRound(currentRoundResults[id])),
    ...unresolvedCurrentIds,
  ]).filter((id) => currentRoundSet.has(id) && !masteredSet.has(id));
  const correctThisRoundIds = currentRoundIds.filter(
    (id) => isCorrectResult(currentRoundResults[id]),
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

  const sanitizeCounters = (record: Record<string, number>): Record<string, number> =>
    Object.fromEntries(
      Object.entries(record)
        .filter(([id, count]) => availableCardIds.has(id) && Number.isFinite(count))
        .map(([id, count]) => [id, Math.max(0, Math.floor(count))]),
    );

  const status = currentRoundIndex < currentRoundIds.length
    ? "active"
    : unseenIds.length === 0
      && retryIds.length === 0
      && failedThisRoundIds.length === 0
      && masteredIds.length === availableCardIds.size
      ? "journey-complete"
      : "round-complete";

  const repairedState: MasterySessionState = {
    version: 2,
    totalEligible: availableCardIds.size,
    roundSize: MASTERY_ROUND_SIZE,
    shuffle: row.shuffle,
    status,
    roundNumber: Math.max(1, Math.floor(row.roundNumber)),
    currentRoundIds,
    currentRoundIndex,
    unseenIds,
    retryIds,
    masteredIds,
    attemptsByCard: sanitizeCounters(row.attemptsByCard),
    mistakesByCard: sanitizeCounters(row.mistakesByCard),
    correctThisRoundIds,
    failedThisRoundIds,
    reviewSourceThisRound: dedupeIds(filterIds(row.reviewSourceThisRound)).filter((id) => currentRoundSet.has(id)),
    currentRoundResults,
  };

  if (!validateMasterySessionState(repairedState, availableCardIds).valid) return null;
  return repairedState;
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

/**
 * Reads the local mastery snapshot together with the moment it was written.
 * The timestamp is required to decide precedence against the remote session
 * row: without it a stale local copy would always win over a newer session
 * saved on another device/tab.
 */
export function readMasterySnapshotWithMeta(
  key: string,
  availableCardIds: Set<string>,
): { state: MasterySessionState; savedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: unknown };
    const state = sanitizeMasterySnapshot(parsed, availableCardIds);
    if (!state) return null;
    const savedAt = typeof parsed?.savedAt === "number" && Number.isFinite(parsed.savedAt)
      ? parsed.savedAt
      : 0;
    return { state, savedAt };
  } catch {
    return null;
  }
}

export function writeMasterySnapshot(key: string, state: MasterySessionState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...state, savedAt: Date.now() }));
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
