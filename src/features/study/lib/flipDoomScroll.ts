export const FLIP_DOOM_SCROLL_STORAGE_KEY = "piteco:flip-doom-scroll:v1";

export interface FlipDoomPreviewCard {
  id: string;
  front: string;
  back: string;
  imageUrlA?: string | null;
  imageUrlB?: string | null;
}

export interface FlipDoomQueueWindow {
  previousId: string | null;
  nextId: string | null;
}

interface PersistedQueueCandidate {
  cardsOrder: string[];
  currentIndex: number;
  timestamp: number;
}

export function readFlipDoomScrollPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FLIP_DOOM_SCROLL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeFlipDoomScrollPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FLIP_DOOM_SCROLL_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Device storage is an optional convenience only.
  }
}

function closestOccurrence(order: string[], cardId: string, around: number): number {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  order.forEach((id, index) => {
    if (id !== cardId) return;
    const distance = Math.abs(index - around);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/**
 * Reads only the already-persisted Flip queue so the mobile view can prepare
 * the visual card immediately above and below the current one. The study
 * engine remains the sole owner of queue/progress; this helper never mutates
 * session state and never decides navigation.
 */
export function readFlipDoomQueueWindow(currentCardId: string): FlipDoomQueueWindow | null {
  if (typeof window === "undefined" || !currentCardId) return null;

  const candidates: PersistedQueueCandidate[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith("study-progress-v3:") || !key.includes(":flip:") || key.endsWith(":mastery")) {
        continue;
      }

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<PersistedQueueCandidate> & { version?: number };
      if (parsed.version !== 2 || !Array.isArray(parsed.cardsOrder) || parsed.cardsOrder.length === 0) continue;
      const around = Math.max(0, Math.min(Number(parsed.currentIndex) || 0, parsed.cardsOrder.length - 1));
      if (!parsed.cardsOrder.includes(currentCardId)) continue;
      candidates.push({
        cardsOrder: parsed.cardsOrder.filter((id): id is string => typeof id === "string"),
        currentIndex: around,
        timestamp: Number(parsed.timestamp) || 0,
      });
    }
  } catch {
    return null;
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.timestamp - a.timestamp);

  for (const candidate of candidates) {
    const position = closestOccurrence(candidate.cardsOrder, currentCardId, candidate.currentIndex);
    if (position < 0) continue;
    return {
      previousId: position > 0 ? candidate.cardsOrder[position - 1] : null,
      nextId: position < candidate.cardsOrder.length - 1 ? candidate.cardsOrder[position + 1] : null,
    };
  }

  return null;
}
