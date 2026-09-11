import { sanitizeRewriteFlowState, type RewriteFlowState } from "./writeRewriteFlow";

interface RewriteSnapshotEnvelope {
  version: 1;
  states: Record<string, RewriteFlowState>;
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
    const state = sanitizeRewriteFlowState(parsed.states?.[cardId]);
    if (
      parsed.version !== 1
      || !Number.isFinite(Number(parsed.timestamp))
      || now - Number(parsed.timestamp) > MAX_AGE_MS
    ) {
      window.localStorage.removeItem(key);
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
    const key = rewriteSnapshotKey(studySnapshotKey);
    const current = window.localStorage.getItem(key);
    const parsed = current ? JSON.parse(current) as Partial<RewriteSnapshotEnvelope> : null;
    const states = parsed?.version === 1 && parsed.states && typeof parsed.states === "object"
      ? parsed.states
      : {};
    const payload: RewriteSnapshotEnvelope = {
      version: 1,
      states: { ...states, [cardId]: state },
      timestamp: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // The active view remains usable when local persistence is unavailable.
  }
}

export function clearRewriteCardSnapshot(studySnapshotKey: string | undefined, cardId: string): void {
  if (typeof window === "undefined" || !studySnapshotKey || !cardId) return;
  const key = rewriteSnapshotKey(studySnapshotKey);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<RewriteSnapshotEnvelope>;
    if (parsed.version !== 1 || !parsed.states || typeof parsed.states !== "object") {
      window.localStorage.removeItem(key);
      return;
    }
    const states = { ...parsed.states };
    delete states[cardId];
    if (Object.keys(states).length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify({ ...parsed, states, timestamp: Date.now() }));
  } catch {
    // Ignore unavailable storage.
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