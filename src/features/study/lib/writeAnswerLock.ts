/**
 * Small module-level signal that tracks whether the active Write view is
 * currently awaiting a first submission (no evaluation shown yet).
 *
 * While locked, global keyboard shortcuts for "next card" / "skip" / "next
 * layer" must be suppressed so they don't conflict with typing in the answer
 * textarea (which can lose focus in some layouts) and don't let the user
 * bypass the Advance Gate.
 */

let locked = false;
const listeners = new Set<(locked: boolean) => void>();

export function isWriteAnswerLocked(): boolean {
  return locked;
}

export function setWriteAnswerLocked(next: boolean): void {
  if (next === locked) return;
  locked = next;
  listeners.forEach((fn) => {
    try { fn(locked); } catch { /* noop */ }
  });
}

export function subscribeWriteAnswerLock(fn: (locked: boolean) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}