export interface StraightThroughContext {
  mode?: unknown;
  studyFlowMode?: unknown;
  subset?: unknown;
  redFocus?: unknown;
  sessionScopeKey?: unknown;
  settingsSnapshot?: unknown;
}

export interface StraightThroughRepairResult {
  cardsOrder: string[];
  currentIndex: number;
  repaired: boolean;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function modeFromScopeKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const marker = "study-session-v3:";
  const markerIndex = value.indexOf(marker);
  if (markerIndex < 0) return null;
  const encodedMode = value.slice(markerIndex + marker.length).split(":")[0];
  if (!encodedMode) return null;
  try {
    return decodeURIComponent(encodedMode);
  } catch {
    return encodedMode;
  }
}

function flowFromScopeKey(value: unknown): "continuous" | "mastery_rounds" | null {
  if (typeof value !== "string") return null;
  if (value.includes(":mastery_rounds")) return "mastery_rounds";
  if (value.includes(":continuous")) return "continuous";
  return null;
}

function scopeFromScopeKey(value: unknown): "all" | "favorites" | "red-focus" | null {
  if (typeof value !== "string") return null;
  if (value.includes(":red-focus:")) return "red-focus";
  if (value.includes(":favorites:")) return "favorites";
  if (value.includes(":all:")) return "all";
  return null;
}

export function resolveStraightThroughContext(input: StraightThroughContext) {
  const settings = record(input.settingsSnapshot);
  const mode = typeof input.mode === "string" && input.mode.length > 0
    ? input.mode
    : typeof settings.mode === "string" && settings.mode.length > 0
      ? settings.mode
      : modeFromScopeKey(input.sessionScopeKey);

  const flow = input.studyFlowMode === "continuous" || input.studyFlowMode === "mastery_rounds"
    ? input.studyFlowMode
    : settings.studyFlowMode === "continuous" || settings.studyFlowMode === "mastery_rounds"
      ? settings.studyFlowMode
      : flowFromScopeKey(input.sessionScopeKey) ?? "continuous";

  const scopeFromKey = scopeFromScopeKey(input.sessionScopeKey);
  const subset = input.subset === "favorites" || settings.subset === "favorites" || settings.scope === "favorites"
    ? "favorites"
    : scopeFromKey === "favorites"
      ? "favorites"
      : "all";
  const redFocus = input.redFocus === true || settings.redFocus === true || scopeFromKey === "red-focus";

  return {
    mode,
    flow,
    subset,
    redFocus,
    enabled: Boolean(mode) && mode !== "mixed" && flow === "continuous" && !redFocus,
    preserveRedPrioritySignature: subset === "favorites" && !redFocus,
  } as const;
}

/**
 * Extenso is a finite straight-through queue. Ordinary playable IDs can appear
 * once. The existing favorites+red priority feature is intentionally preserved:
 * its engine writes exactly four total appearances (original + three extras),
 * so that signature receives a budget of four. Mixed and mastery are excluded.
 *
 * The cursor is translated by counting the surviving entries before the saved
 * position. If the saved position itself was an accidental duplicate, resume
 * lands on the next surviving logical turn instead of replaying the old card.
 */
export function repairStraightThroughOrder(input: {
  sessionOrder: unknown;
  currentIndex: unknown;
  availableCardIds: ReadonlySet<string>;
  context: StraightThroughContext;
}): StraightThroughRepairResult | null {
  if (!Array.isArray(input.sessionOrder)) return null;

  const filtered = input.sessionOrder
    .filter((id): id is string => typeof id === "string")
    .filter((id) => input.availableCardIds.has(id));
  if (filtered.length === 0) return null;

  const present = new Set(filtered);
  const missingIds = Array.from(input.availableCardIds).filter((id) => !present.has(id));
  const rawIndex = Math.min(
    Math.max(Number.isFinite(Number(input.currentIndex)) ? Math.floor(Number(input.currentIndex)) : 0, 0),
    filtered.length - 1,
  );
  const context = resolveStraightThroughContext(input.context);

  if (!context.enabled) {
    const cardsOrder = [...filtered, ...missingIds];
    return {
      cardsOrder,
      currentIndex: Math.min(rawIndex, cardsOrder.length - 1),
      repaired: missingIds.length > 0,
    };
  }

  const totals = new Map<string, number>();
  for (const id of filtered) totals.set(id, (totals.get(id) ?? 0) + 1);

  const kept = new Map<string, number>();
  const cardsOrder: string[] = [];
  let translatedIndex = 0;

  filtered.forEach((id, offset) => {
    const total = totals.get(id) ?? 1;
    // Intentional red priority currently has four occurrences in favorites.
    // A normal card repeated two or three times is accidental and collapses.
    const budget = context.preserveRedPrioritySignature && total >= 4 ? 4 : 1;
    const used = kept.get(id) ?? 0;
    const keep = used < budget;
    if (offset < rawIndex && keep) translatedIndex += 1;
    if (!keep) return;
    kept.set(id, used + 1);
    cardsOrder.push(id);
  });

  cardsOrder.push(...missingIds);
  translatedIndex = Math.min(translatedIndex, Math.max(0, cardsOrder.length - 1));

  const expectedRaw = [...filtered, ...missingIds];
  const repaired = expectedRaw.length !== cardsOrder.length
    || expectedRaw.some((id, index) => cardsOrder[index] !== id)
    || translatedIndex !== rawIndex;

  return { cardsOrder, currentIndex: translatedIndex, repaired };
}
