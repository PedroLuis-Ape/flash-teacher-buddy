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

export function sanitizeStudySnapshot(
  value: unknown,
  availableCardIds: Set<string>,
): StudySessionSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<StudySessionSnapshot>;
  if (row.version !== 2 || !Array.isArray(row.cardsOrder) || row.cardsOrder.length === 0) {
    return null;
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
): StudySessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? sanitizeStudySnapshot(JSON.parse(raw), availableCardIds) : null;
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
