export type StudyScope = "all" | "favorites" | "red";

export interface PersonalStudySubsetResolution {
  subset: "all" | "favorites";
  requestedSubset: "all" | "favorites";
  degraded: boolean;
}

export interface StudyScopeSettings {
  subset: "all" | "favorites";
  redFocus?: boolean;
}

export interface StudyScopeCard {
  id: string;
  parent_card_id?: string | null;
  status_group_uid?: string | null;
  __parentCardId?: string | null;
  __statusGroupUid?: string | null;
  __layers?: ReadonlyArray<{
    id: string;
    parent_card_id?: string | null;
    status_group_uid?: string | null;
    __parentCardId?: string | null;
    __statusGroupUid?: string | null;
  }>;
}

export function resolveStudyScope(settings: StudyScopeSettings): StudyScope {
  if (settings.redFocus) return "red";
  return settings.subset === "favorites" ? "favorites" : "all";
}

/**
 * Favorites are private user data. A public/anonymous study route must never
 * interpret the absence of that private capability as an empty deck.
 * Returning the degradation explicitly lets the screen explain the fallback
 * without persisting a false preference or hiding playable public cards.
 */
export function resolvePersonalStudySubset(
  requestedSubset: "all" | "favorites",
  canUsePersonalFavorites: boolean,
): PersonalStudySubsetResolution {
  return {
    subset: requestedSubset === "favorites" && canUsePersonalFavorites ? "favorites" : "all",
    requestedSubset,
    degraded: requestedSubset === "favorites" && !canUsePersonalFavorites,
  };
}

export function shouldInjectRedPriority(settings: StudyScopeSettings): boolean {
  return resolveStudyScope(settings) === "favorites";
}

/**
 * Readiness of the private scope data (favorites / red list) for the ACTIVE
 * session scope. This is the single place that decides whether a scope filter
 * may be applied, and it never converts "still loading" or "failed" into
 * "empty". A confirmed-empty scope requires an authenticated user, a settled
 * successful query and non-placeholder data.
 */
export type StudyScopeDataStatus = "not-required" | "loading" | "error" | "ready";

export interface StudyScopeQueryState {
  isSuccess: boolean;
  isError: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  isPlaceholderData: boolean;
}

export function resolveStudyScopeDataStatus(input: {
  required: boolean;
  /** Undefined/empty when the route has no private capability (public/anon). */
  userId?: string | null;
  query: StudyScopeQueryState;
}): StudyScopeDataStatus {
  if (!input.required) return "not-required";
  if (!input.userId) return "not-required";
  if (input.query.isSuccess
    && input.query.fetchStatus !== "fetching"
    && !input.query.isPlaceholderData) {
    return "ready";
  }
  if (input.query.isError && input.query.fetchStatus !== "fetching") return "error";
  return "loading";
}

export function isStudyScopeDataUsable(status: StudyScopeDataStatus): boolean {
  return status === "not-required" || status === "ready";
}

function cardMatchesIds(card: StudyScopeCard, ids: ReadonlySet<string>): boolean {
  if (ids.has(card.id)) return true;
  if (card.status_group_uid && ids.has(card.status_group_uid)) return true;
  if (card.parent_card_id && ids.has(card.parent_card_id)) return true;
  if (card.__parentCardId && ids.has(card.__parentCardId)) return true;

  return (card.__layers ?? []).some((layer) => {
    if (ids.has(layer.id)) return true;
    if (layer.status_group_uid && ids.has(layer.status_group_uid)) return true;
    if (layer.parent_card_id && ids.has(layer.parent_card_id)) return true;
    if (layer.__parentCardId && ids.has(layer.__parentCardId)) return true;
    return false;
  });
}

export function filterCardsForStudyScope<TCard extends StudyScopeCard>({
  cards,
  favoriteIds,
  redListIds,
  settings,
}: {
  cards: ReadonlyArray<TCard>;
  favoriteIds: ReadonlyArray<string>;
  redListIds: ReadonlyArray<string>;
  settings: StudyScopeSettings;
}): TCard[] {
  const scope = resolveStudyScope(settings);
  if (scope === "all") return [...cards];

  const ids = new Set(scope === "red" ? redListIds : favoriteIds);
  return cards.filter((card) => cardMatchesIds(card, ids));
}
