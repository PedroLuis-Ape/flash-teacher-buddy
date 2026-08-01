import type {
  StudyDeckSource,
} from "./studyDeckLoader";
import type { StudyDeckUnconfirmedReason } from "./studyDeckAvailability";

export type StudyDeckLoadPhase =
  | "idle"
  | "waiting-auth"
  | "loading"
  | "retrying"
  | "ready"
  | "empty-unconfirmed"
  | "confirmed-empty"
  | "recoverable-error"
  | "cancelled";

export type StudyDeckLoadState =
  | { phase: "idle" }
  | { phase: "waiting-auth"; reason: "auth" | "preferences" }
  | { phase: "loading" | "retrying"; attempt: number; requestId?: string }
  | {
      phase: "ready";
      requestId: string;
      source: StudyDeckSource;
      rawCount: number;
      playableCount: number;
    }
  | {
      phase: "empty-unconfirmed";
      requestId?: string;
      source?: StudyDeckSource;
      reason: StudyDeckUnconfirmedReason | "offline-empty";
    }
  | {
      phase: "confirmed-empty";
      requestId: string;
      source: StudyDeckSource;
    }
  | { phase: "recoverable-error"; reason: string; requestId?: string }
  | { phase: "cancelled"; requestId?: string };

export function isStudyDeckLoading(state: StudyDeckLoadState): boolean {
  return state.phase === "waiting-auth"
    || state.phase === "loading"
    || state.phase === "retrying";
}

export function studyDeckRecoveryReason(state: StudyDeckLoadState): string | null {
  if (state.phase === "empty-unconfirmed" || state.phase === "recoverable-error") {
    return state.reason;
  }
  return null;
}

export function studyDeckTechnicalId(prefix: "ST" | "MX", state: StudyDeckLoadState): string {
  const suffix = state.phase === "empty-unconfirmed" || state.phase === "recoverable-error"
    ? state.reason
    : state.phase;
  return `${prefix}-${suffix}`;
}
