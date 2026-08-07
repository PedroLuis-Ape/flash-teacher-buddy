import { hashToBool, normalizeDirection, type Direction } from "@/features/study/lib/gameCore";

export type WriteActivityMode = "translate" | "rewrite";
export type WriteRewriteSide = "a" | "b" | "alternating";
export type WriteActivityGameMode = "write" | "mixed";

export interface WriteActivityPreference {
  mode: WriteActivityMode;
  rewriteSide: WriteRewriteSide;
}

export interface WriteActivityPreferenceChangedDetail {
  gameMode: WriteActivityGameMode;
  preference: WriteActivityPreference;
}

export const WRITE_ACTIVITY_PREFERENCE_STORAGE_KEY = "ape.writeActivityPreference.v1";
export const WRITE_ACTIVITY_PREFERENCE_CHANGED_EVENT = "ape:writeActivityPreferenceChanged";

export const DEFAULT_WRITE_ACTIVITY_PREFERENCE: WriteActivityPreference = Object.freeze({
  mode: "translate",
  rewriteSide: "alternating",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMode(value: unknown): value is WriteActivityMode {
  return value === "translate" || value === "rewrite";
}

function isRewriteSide(value: unknown): value is WriteRewriteSide {
  return value === "a" || value === "b" || value === "alternating";
}

/**
 * MAPEAMENTO CANÔNICO entre direção de estudo e lado da reescrita.
 *
 *   writeRewriteSide "a"           <-> direction "b-a"  (responder no lado A)
 *   writeRewriteSide "b"           <-> direction "a-b"  (responder no lado B)
 *   writeRewriteSide "alternating" <-> direction "any"
 */
export function rewriteSideToDirection(side: unknown): Direction {
  if (side === "a") return "b-a";
  if (side === "b") return "a-b";
  return "any";
}

export function directionToRewriteSide(direction: unknown): WriteRewriteSide {
  const normalized = normalizeDirection(typeof direction === "string" ? direction : "any");
  if (normalized === "b-a") return "a";
  if (normalized === "a-b") return "b";
  return "alternating";
}

export function resolveWriteActivityGameMode(explicit?: string): WriteActivityGameMode {
  if (explicit === "mixed" || explicit === "write") return explicit;
  if (typeof window === "undefined") return "write";
  try {
    return new URLSearchParams(window.location.search).get("mode") === "mixed" ? "mixed" : "write";
  } catch {
    return "write";
  }
}

export function buildWriteActivityPreferenceStorageKey(gameMode?: string): string {
  return `${WRITE_ACTIVITY_PREFERENCE_STORAGE_KEY}:${resolveWriteActivityGameMode(gameMode)}`;
}

export function normalizeWriteActivityPreference(value: unknown): WriteActivityPreference {
  const input = isRecord(value) ? value : {};
  return {
    mode: isMode(input.mode) ? input.mode : DEFAULT_WRITE_ACTIVITY_PREFERENCE.mode,
    rewriteSide: isRewriteSide(input.rewriteSide)
      ? input.rewriteSide
      : DEFAULT_WRITE_ACTIVITY_PREFERENCE.rewriteSide,
  };
}

export function readWriteActivityPreference(gameMode?: string): WriteActivityPreference {
  if (typeof window === "undefined") return { ...DEFAULT_WRITE_ACTIVITY_PREFERENCE };
  try {
    const stored = window.localStorage.getItem(buildWriteActivityPreferenceStorageKey(gameMode));
    return stored ? normalizeWriteActivityPreference(JSON.parse(stored)) : { ...DEFAULT_WRITE_ACTIVITY_PREFERENCE };
  } catch {
    return { ...DEFAULT_WRITE_ACTIVITY_PREFERENCE };
  }
}

export function writeWriteActivityPreference(
  preference: WriteActivityPreference,
  gameMode?: string,
): void {
  if (typeof window === "undefined") return;
  const resolvedGameMode = resolveWriteActivityGameMode(gameMode);
  const normalized = normalizeWriteActivityPreference(preference);
  try {
    window.localStorage.setItem(
      buildWriteActivityPreferenceStorageKey(resolvedGameMode),
      JSON.stringify(normalized),
    );
    window.dispatchEvent(new CustomEvent<WriteActivityPreferenceChangedDetail>(
      WRITE_ACTIVITY_PREFERENCE_CHANGED_EVENT,
      { detail: { gameMode: resolvedGameMode, preference: normalized } },
    ));
  } catch {
    // Local storage may be blocked. The current screen still keeps its in-memory state.
  }
}

function rewriteSessionKey(): string {
  if (typeof window === "undefined") return "server";
  return `${window.location.pathname}:${new URLSearchParams(window.location.search).get("mode") || "write"}`;
}

export function resolveRewriteSideForCard(
  cardKey: string,
  preference: WriteRewriteSide,
): "a" | "b" {
  if (preference === "a" || preference === "b") return preference;

  const sessionKey = rewriteSessionKey();
  let state = alternatingStates.get(sessionKey);
  if (!state) {
    state = { assignments: new Map(), next: "a" };
    alternatingStates.set(sessionKey, state);
  }

  const assigned = state.assignments.get(cardKey);
  if (assigned) return assigned;

  const next = state.next;
  state.assignments.set(cardKey, next);
  state.next = next === "a" ? "b" : "a";
  return next;
}

export function resetRewriteSideAssignmentsForTests(): void {
  alternatingStates.clear();
}
