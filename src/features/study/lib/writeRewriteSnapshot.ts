import { sanitizeRewriteFlowState, type RewriteFlowState } from "./writeRewriteFlow";

interface RewriteSnapshotEnvelope {
  version: 1;
  cardId: string;
  state: RewriteFlowState;
  timestamp: number;
}

const SUFFIX = ":rewrite";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function rewriteSnapshotKey(studySnapshotKey: string): string {
  return `${studySnapshotKey}${SUFFIX}`;
}

export function readRewriteSnapshot(
  studySnapshotKey: string | undefined,
  cardId: string,
  now: number = Date.now(),
): RewriteFlowState | null {
  if (typeof window === "undefined" || !studySnapshotKey || !cardId) return null;
  const key = rewriteSnapshotKey(studySnapshotKey);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RewriteSnapshotEnvelope>;
    const state = sanitizeRewriteFlowState(parsed.state);
    if (
      parsed.version !== 1
      || parsed.cardId !== cardId
      || !state
      || !Number.isFinite(Number(parsed.timestamp))
      || now - Number(parsed.timestamp) > MAX_AGE_MS
    ) {
      if (parsed.cardId === cardId || !Number.isFinite(Number(parsed.timestamp))) {
        window.localStorage.removeItem(key);
      }
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

export function writeRewriteSnapshot(
  studySnapshotKey: string | undefined,
  cardId: string,
  state: RewriteFlowState,
): void {
  if (typeof window === "undefined" || !studySnapshotKey || !cardId) return;
  try {
    const payload: RewriteSnapshotEnvelope = {
      version: 1,
      cardId,
      state,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(rewriteSnapshotKey(studySnapshotKey), JSON.stringify(payload));
  } catch {
    // The active view remains usable when local persistence is unavailable.
  }
}

export function clearRewriteSnapshot(studySnapshotKey: string | undefined): void {
  if (typeof window === "undefined" || !studySnapshotKey) return;
  try {
    window.localStorage.removeItem(rewriteSnapshotKey(studySnapshotKey));
  } catch {
    // Ignore unavailable storage.
  }
}