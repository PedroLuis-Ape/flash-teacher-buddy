import type { StudyDeckResourceKind, StudyDeckSource } from "./studyDeckLoader";

export function buildStudyDeckRequestContextKey(input: {
  resourceId: string;
  resourceKind: StudyDeckResourceKind;
  source: StudyDeckSource;
  userId?: string | null;
}): string {
  return [
    input.source,
    input.resourceKind,
    input.resourceId,
    input.userId || "anon",
  ].join("|");
}

export function isStudyDeckRequestCurrent(input: {
  activeGeneration: number;
  generation: number;
  activeContextKey: string;
  contextKey: string;
  signal: AbortSignal;
}): boolean {
  return !input.signal.aborted
    && input.activeGeneration === input.generation
    && input.activeContextKey === input.contextKey;
}
