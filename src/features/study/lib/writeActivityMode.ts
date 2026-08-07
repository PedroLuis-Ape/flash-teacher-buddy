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

export function isWriteRewriteSide(value: unknown): value is WriteRewriteSide {
  return value === "a" || value === "b" || value === "alternating";
}

/**
 * Converts the general practice direction into the side the learner must
 * reproduce in Rewrite mode.
 *
 * a-b shows A and answers in B, therefore Rewrite targets B.
 * b-a shows B and answers in A, therefore Rewrite targets A.
 */
export function directionToRewriteSide(direction: Direction | string): WriteRewriteSide {
  const normalized = normalizeDirection(direction);
  if (normalized === "a-b") return "b";
  if (normalized === "b-a") return "a";
  return "alternating";
}

/** Converts a Rewrite target side back into the equivalent practice direction. */
export function rewriteSideToDirection(side: WriteRewriteSide): Direction {
  if (side === "a") return "b-a";
  if (side === "b") return "a-b";
  return "any";
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
    rewriteSide: isWriteRewriteSide(input.rewriteSide)
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

/**
 * Resolves the effective Rewrite target for one playable identity.
 *
 * Fixed A/B choices never vary. "alternating" deliberately uses the same
 * deterministic hash as direction="any": when A is shown first, B is the
 * response side; when B is shown first, A is the response side. This keeps
 * both selectors semantically synchronized across cards, layers and rerenders.
 */
export function resolveRewriteSideForCard(
  cardKey: string,
  preference: WriteRewriteSide,
): "a" | "b" {
  if (preference === "a" || preference === "b") return preference;
  return hashToBool(cardKey) ? "b" : "a";
}

/** Kept as a compatibility hook for older tests; resolution is now stateless. */
export function resetRewriteSideAssignmentsForTests(): void {
  // no-op
}
