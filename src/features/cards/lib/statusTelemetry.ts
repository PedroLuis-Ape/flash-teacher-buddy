/**
 * statusTelemetry — non-destructive drift detector between the legacy
 * (`user_favorites` + `user_red_list`) and new (`user_flashcard_group_status`)
 * models, used during the dual-read window (Phase 5).
 *
 * Logs (console.warn + optional callback) but never mutates state. Safe to
 * call from any read path; cheap because it works on already-fetched arrays.
 */

export interface DriftReport {
  statusGroupUid: string;
  legacyIsFavorite: boolean;
  newIsFavorite: boolean;
  legacyIsRedList: boolean;
  newIsRedList: boolean;
}

export type DriftListener = (report: DriftReport) => void;

const listeners = new Set<DriftListener>();

export function onStatusDrift(fn: DriftListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function reportDrift(report: DriftReport): void {
  if (
    report.legacyIsFavorite === report.newIsFavorite &&
    report.legacyIsRedList === report.newIsRedList
  ) {
    return;
  }
  // eslint-disable-next-line no-console
  console.warn("[claraMaster] status drift", report);
  for (const fn of listeners) {
    try { fn(report); } catch { /* listeners must not throw */ }
  }
}

/** Test-only: clear listeners. */
export function __resetTelemetryForTests(): void {
  listeners.clear();
}