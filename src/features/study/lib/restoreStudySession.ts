import { sanitizeStudyLayerSnapshot, type StudySessionSnapshot, type PersistedStudyResult } from "./studySessionSnapshot";
import { sanitizeMasterySnapshot } from "./masterySessionSnapshot";
import { createMasterySession } from "./studySessionFlow";

export interface RestorableStudySession {
  id: string;
  completed?: boolean;
  cards_order?: unknown;
  current_index?: unknown;
  session_snapshot?: unknown;
  settings_snapshot?: unknown;
  session_scope_key?: unknown;
  updated_at?: unknown;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function index(value: unknown): number {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
}

/** A requested row is authoritative. Local mirrors must prove the same identity. */
export function restoreStudySession(input: {
  session: RestorableStudySession;
  eligibleIds: readonly string[];
  local?: unknown;
  unique?: boolean;
  resultCardIds?: ReadonlySet<string>;
}): { snapshot: StudySessionSnapshot; source: "session_snapshot" | "cards_order" | "local" | "repaired"; repaired: boolean } {
  const { session, eligibleIds } = input;
  const eligible = new Set(eligibleIds);
  const remote = record(session.session_snapshot);
  const localRow = record(input.local);
  const local = localRow.sessionId === session.id ? localRow : {};
  const remoteValid = remote.version === 2 && (remote.sessionId == null || remote.sessionId === session.id);
  const remoteSavedAt = Math.max(
    Date.parse(String(session.updated_at ?? "")) || 0,
    Number.isFinite(Number(remote.timestamp)) ? Number(remote.timestamp) : 0,
  );
  const localSavedAt = Number.isFinite(Number(local.timestamp)) ? Number(local.timestamp) : 0;
  const localIsNewer = localSavedAt > remoteSavedAt;
  const remoteCandidates = [
    { source: "session_snapshot" as const, row: remoteValid ? remote : {} },
    { source: "cards_order" as const, row: { cardsOrder: session.cards_order, currentIndex: session.current_index } },
  ];
  const candidates = localIsNewer
    ? [{ source: "local" as const, row: local }, ...remoteCandidates]
    : [...remoteCandidates, { source: "local" as const, row: local }];
  const selected = candidates.find(({ row }) => Array.isArray(row.cardsOrder) && row.cardsOrder.some(id => typeof id === "string" && eligible.has(id)));
  const resultSource = selected?.source === "local"
    ? local
    : selected?.source === "session_snapshot"
      ? remote
      : remoteValid
        ? remote
        : {};
  const results = (Array.isArray(resultSource.results) ? resultSource.results : []).filter((value): value is PersistedStudyResult => {
    const row = record(value);
    return typeof row.flashcardId === "string" && (input.resultCardIds ?? eligible).has(row.flashcardId)
      && typeof row.correct === "boolean" && typeof row.skipped === "boolean" && Number.isFinite(row.attempts);
  });
  const persistedRoundResults = (Array.isArray(resultSource.roundResults) ? resultSource.roundResults : [])
    .filter((value): value is PersistedStudyResult => {
      const row = record(value);
      return typeof row.flashcardId === "string"
        && (input.resultCardIds ?? eligible).has(row.flashcardId)
        && typeof row.correct === "boolean"
        && typeof row.skipped === "boolean"
        && Number.isFinite(row.attempts);
    });
  const persistedIds = (value: unknown) => Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string" && eligible.has(id))
    : [];
  const raw = selected?.row.cardsOrder as unknown[] | undefined;
  const position = index(selected?.row.currentIndex ?? session.current_index);
  const seen = new Set<string>();
  let before = 0;
  let cardsOrder = (raw ?? []).filter((id, offset): id is string => {
    if (typeof id !== "string" || !eligible.has(id) || (input.unique && seen.has(id))) return false;
    seen.add(id);
    if (offset < position) before++;
    return true;
  });
  // Preserve existing order and repetitions. Newly eligible cards belong at the end.
  cardsOrder.push(...eligibleIds.filter(id => !seen.has(id)));
  if (!selected) {
    // With no recoverable ordering, only explicit answer evidence can identify
    // completed cards. Never interpret an orphaned numeric index as card identity.
    const answered = new Set(results.map(result => result.flashcardId));
    cardsOrder = [...eligibleIds.filter(id => answered.has(id)), ...eligibleIds.filter(id => !answered.has(id))];
    before = results.length ? cardsOrder.filter(id => answered.has(id)).length : position;
  }
  const currentIndex = session.completed ? cardsOrder.length : Math.min(before, Math.max(0, cardsOrder.length - 1));
  const layer = sanitizeStudyLayerSnapshot(resultSource.layer);
  const snapshot: StudySessionSnapshot = {
    version: 2, sessionId: session.id, cardsOrder, currentIndex, results,
    timestamp: Math.max(Date.now(), localSavedAt, remoteSavedAt), ...(layer ? { layer } : {}),
    ...(Number.isFinite(Number(resultSource.roundNumber))
      ? { roundNumber: Math.max(1, Math.floor(Number(resultSource.roundNumber))) }
      : {}),
    ...(persistedRoundResults.length > 0 ? { roundResults: persistedRoundResults } : {}),
    ...(Array.isArray(resultSource.unseenCards) ? { unseenCards: persistedIds(resultSource.unseenCards) } : {}),
    ...(Array.isArray(resultSource.missedCards) ? { missedCards: persistedIds(resultSource.missedCards) } : {}),
    ...(typeof resultSource.isFinished === "boolean" ? { isFinished: resultSource.isFinished } : {}),
  };
  return {
    snapshot, source: selected?.source ?? "repaired",
    repaired: !selected || JSON.stringify(raw) !== JSON.stringify(cardsOrder) || position !== currentIndex
      || JSON.stringify(session.cards_order) !== JSON.stringify(cardsOrder) || session.current_index !== currentIndex,
  };
}

/** Shared write boundary: incomplete runtime queues cannot erase durable progress. */
export function assertStudySessionWrite(payload: Record<string, unknown>): void {
  const snapshot = record(payload.session_snapshot);
  const queues = [payload.cards_order, snapshot.cardsOrder, snapshot.currentRoundIds];
  if (payload.completed !== true && queues.some(queue => Array.isArray(queue) && queue.length === 0)) {
    throw new Error("study-session-empty-write-blocked");
  }
}

export function restoreMasterySession(session: RestorableStudySession, eligibleIds: string[], shuffle: boolean) {
  const eligible = new Set(eligibleIds);
  const valid = sanitizeMasterySnapshot(session.session_snapshot, eligible);
  if (valid) return valid;
  const old = record(session.session_snapshot);
  const mastered = [...new Set(Array.isArray(old.masteredIds)
    ? old.masteredIds.filter((id): id is string => typeof id === "string" && eligible.has(id)) : [])];
  const pending = eligibleIds.filter(id => !mastered.includes(id));
  // Recover ordering from the row without re-awarding mastered cards. The round
  // engine still owns round size, retry bookkeeping and completion semantics.
  const restored = restoreStudySession({ session, eligibleIds: pending, unique: true });
  const state = createMasterySession(restored.snapshot.cardsOrder, { shuffle: false });
  const counters = (value: unknown) => Object.fromEntries(Object.entries(record(value))
    .filter(([id, count]) => eligible.has(id) && typeof count === "number" && Number.isFinite(count))
    .map(([id, count]) => [id, index(count)]));
  const recovered = {
    ...state, shuffle, totalEligible: eligibleIds.length, masteredIds: mastered,
    currentRoundIndex: Math.min(restored.snapshot.currentIndex, Math.max(0, state.currentRoundIds.length - 1)),
    roundNumber: Math.max(1, index(old.roundNumber)),
    attemptsByCard: counters(old.attemptsByCard),
    mistakesByCard: counters(old.mistakesByCard),
  };
  // Reuse the mastery validator to preserve compatible per-round evidence.
  return sanitizeMasterySnapshot({ ...recovered, currentRoundResults: old.currentRoundResults ?? {} }, eligible) ?? recovered;
}
