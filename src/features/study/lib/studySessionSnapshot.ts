export interface PersistedStudyResult {
  flashcardId: string;
  correct: boolean;
  skipped: boolean;
  attempts: number;
}

export interface StudySessionSnapshot {
  version: 2;
  sessionId: string | null;
  currentIndex: number;
  cardsOrder: string[];
  results: PersistedStudyResult[];
  timestamp: number;
}

export interface SanitizedPersistedStudyOrder {
  cardsOrder: string[];
  currentIndex: number;
  repaired: boolean;
}

export interface StudySnapshotSanitizeOptions {
  enforceUniqueOrder?: boolean;
}

function safeScope(value: string | null | undefined): string {
  return (value || "anon").replace(/[^a-zA-Z0-9:_-]/g, "_");
}

function hashScope(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function buildStudySnapshotKey(input: {
  userScope?: string | null;
  listId?: string | null;
  mode: string;
  sessionScopeKey: string;
  cardsSignature: string;
}): string {
  return [
    "study-progress-v2",
    safeScope(input.userScope),
    safeScope(input.listId || "no-list"),
    safeScope(input.mode),
    safeScope(input.sessionScopeKey),
    hashScope(input.cardsSignature),
  ].join(":");
}

function isResult(value: unknown): value is PersistedStudyResult {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<PersistedStudyResult>;
  return typeof row.flashcardId === "string"
    && typeof row.correct === "boolean"
    && typeof row.skipped === "boolean"
    && Number.isFinite(Number(row.attempts));
}

/**
 * Validates a persisted queue against the current effective deck.
 *
 * Red focus is a strict straight-through scope: the current deck order is the
 * source of truth and every playable card appears exactly once. Old sessions
 * may still contain injected copies (or a randomized order), so those queues
 * are repaired and restarted at index zero. Clean red-focus sessions keep
 * their current index. Other scopes preserve legitimate repetitions.
 */
export function sanitizePersistedStudyOrder({
  sessionOrder,
  currentIndex,
  availableCardIds,
  enforceUniqueOrder,
}: {
  sessionOrder: unknown;
  currentIndex: unknown;
  availableCardIds: ReadonlySet<string>;
  enforceUniqueOrder: boolean;
}): SanitizedPersistedStudyOrder | null {
  if (!Array.isArray(sessionOrder)) return null;

  const filteredOrder = sessionOrder
    .filter((id): id is string => typeof id === "string")
    .filter((id) => availableCardIds.has(id));
  if (filteredOrder.length === 0) return null;

  const savedUnique = new Set(filteredOrder);
  if (savedUnique.size !== availableCardIds.size) return null;
  for (const id of availableCardIds) {
    if (!savedUnique.has(id)) return null;
  }

  const rawIndex = Math.min(
    Math.max(Number(currentIndex) || 0, 0),
    filteredOrder.length - 1,
  );

  if (!enforceUniqueOrder) {
    return {
      cardsOrder: filteredOrder,
      currentIndex: rawIndex,
      repaired: false,
    };
  }

  const canonicalOrder = Array.from(availableCardIds);
  const isCanonicalOrder =
    filteredOrder.length === canonicalOrder.length
    && filteredOrder.every((id, index) => id === canonicalOrder[index]);

  return {
    cardsOrder: canonicalOrder,
    currentIndex: isCanonicalOrder
      ? Math.min(rawIndex, canonicalOrder.length - 1)
      : 0,
    repaired: !isCanonicalOrder,
  };
}

export function sanitizeStudySnapshot(
  value: unknown,
  availableCardIds: Set<string>,
  options: StudySnapshotSanitizeOptions = {},
): StudySessionSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<StudySessionSnapshot>;
  if (row.version !== 2 || !Array.isArray(row.cardsOrder) || row.cardsOrder.length === 0) {
    return null;
  }

  if (options.enforceUniqueOrder) {
    const restored = sanitizePersistedStudyOrder({
      sessionOrder: row.cardsOrder,
      currentIndex: row.currentIndex,
      availableCardIds,
      enforceUniqueOrder: true,
    });
    if (!restored) return null;

    const results = restored.repaired
      ? []
      : Array.isArray(row.results)
        ? row.results.filter(isResult).filter((result) => availableCardIds.has(result.flashcardId))
        : [];

    return {
      version: 2,
      sessionId: typeof row.sessionId === "string" ? row.sessionId : null,
      currentIndex: restored.currentIndex,
      cardsOrder: restored.cardsOrder,
      results,
      timestamp: Number.isFinite(Number(row.timestamp)) ? Number(row.timestamp) : 0,
    };
  }

  const rawCardsOrder = row.cardsOrder
    .filter((id): id is string => typeof id === "string")
    .filter((id) => availableCardIds.has(id));
  if (rawCardsOrder.length === 0) return null;

  const savedUnique = new Set(rawCardsOrder);
  if (savedUnique.size !== availableCardIds.size) return null;
  for (const id of availableCardIds) {
    if (!savedUnique.has(id)) return null;
  }

  // Legacy red-focus sessions injected three extra copies of every red card.
  // When every card in the deck is repeated, this is the dedicated all-red
  // scope rather than a mixed favorites deck. Collapse it to one occurrence
  // per card so the repaired session resumes as an ordinary straight-through
  // deck instead of showing the same card four times.
  const occurrenceCount = new Map<string, number>();
  for (const id of rawCardsOrder) {
    occurrenceCount.set(id, (occurrenceCount.get(id) ?? 0) + 1);
  }
  const isLegacyAllRedOrder = availableCardIds.size > 0
    && Array.from(availableCardIds).every((id) => (occurrenceCount.get(id) ?? 0) > 1);

  const rawCurrentIndex = Math.min(
    Math.max(Number(row.currentIndex) || 0, 0),
    rawCardsOrder.length - 1,
  );
  const cardsOrder = isLegacyAllRedOrder
    ? Array.from(new Set(rawCardsOrder))
    : rawCardsOrder;
  const currentIndex = isLegacyAllRedOrder
    ? Math.min(new Set(rawCardsOrder.slice(0, rawCurrentIndex + 1)).size - 1, cardsOrder.length - 1)
    : Math.min(rawCurrentIndex, cardsOrder.length - 1);
  const results = Array.isArray(row.results)
    ? row.results.filter(isResult).filter((result) => availableCardIds.has(result.flashcardId))
    : [];

  return {
    version: 2,
    sessionId: typeof row.sessionId === "string" ? row.sessionId : null,
    currentIndex: Math.max(currentIndex, 0),
    cardsOrder,
    results,
    timestamp: Number.isFinite(Number(row.timestamp)) ? Number(row.timestamp) : 0,
  };
}

export function readStudySnapshot(
  key: string,
  availableCardIds: Set<string>,
  options: StudySnapshotSanitizeOptions = {},
): StudySessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? sanitizeStudySnapshot(JSON.parse(raw), availableCardIds, options) : null;
  } catch {
    return null;
  }
}

export function writeStudySnapshot(key: string, snapshot: StudySessionSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // Local persistence is a fallback; database persistence remains authoritative.
  }
}

export function clearStudySnapshot(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}
