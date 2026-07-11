/**
 * cardStatusIdentity — single source of truth for "what id should each
 * status system target?" inside the study screen.
 *
 *   - canonicalGroupId : where Favorites & Red List live.
 *       Layered card  → parent_card_id of the group principal.
 *       Normal card   → the card's own id.
 *
 *   - playableEntryId  : the id the engine actually puts into cardsOrder.
 *       Layered card  → layers[0].id (the deck entry-point).
 *       Normal card   → the card's own id.
 *
 *   - visibleLayerId   : the id of the layer currently displayed on screen.
 *       Used ONLY by the Special button (per-layer semantic).
 *
 *   - legacyIds        : every id that could legitimately have an OLD mark
 *       written against it before the canonicalization migration (principal,
 *       any layer, the visible layer). UI uses this list to recognise legacy
 *       state during the migration window; cleanup operations use it as the
 *       `IN (...)` payload of a single DELETE.
 */
export interface ResolveIdentityInput {
  /** The card currently visible (active layer, when layered). */
  displayedCard?: { id?: string | null; parent_card_id?: string | null } | null;
  /** The card at the engine's current index (the deck entry-point). */
  engineCard?: {
    id?: string | null;
    parent_card_id?: string | null;
    __parentCardId?: string | null;
  } | null;
  /** All layers of the current group, or undefined when the card is not layered. */
  layers?: ReadonlyArray<{ id?: string | null; parent_card_id?: string | null }> | null;
}

export interface CardStatusIdentity {
  visibleLayerId: string | null;
  canonicalGroupId: string | null;
  playableEntryId: string | null;
  /** Stable union (deduped) of every id worth checking for legacy state. */
  legacyIds: string[];
}

export function resolveCardStatusIdentity(
  input: ResolveIdentityInput,
): CardStatusIdentity {
  const { displayedCard, engineCard, layers } = input;

  const visibleLayerId =
    displayedCard?.id ?? engineCard?.id ?? null;

  const layerList = Array.isArray(layers) ? layers : [];
  const hasLayers = layerList.length > 1;

  // Canonical group: parent_card_id when layered, otherwise the card itself.
  const explicitCanonical: string | null =
    (displayedCard as any)?.__parentCardId ??
    displayedCard?.parent_card_id ??
    (engineCard as any)?.__parentCardId ??
    engineCard?.parent_card_id ??
    layerList[0]?.parent_card_id ??
    null;
  const canonicalGroupId: string | null =
    explicitCanonical ?? (hasLayers ? null : visibleLayerId);

  // Engine entry-point: when layered, first layer; otherwise the card itself.
  const playableEntryId: string | null = hasLayers
    ? (layerList[0]?.id ?? engineCard?.id ?? null)
    : (engineCard?.id ?? visibleLayerId ?? null);

  const seen = new Set<string>();
  const push = (v: string | null | undefined) => {
    if (v && !seen.has(v)) seen.add(v);
  };
  push(canonicalGroupId);
  push(playableEntryId);
  push(visibleLayerId);
  for (const l of layerList) push(l?.id ?? null);

  return {
    visibleLayerId,
    canonicalGroupId,
    playableEntryId,
    legacyIds: Array.from(seen),
  };
}

/**
 * Build the canonical→playable map the study engine uses to translate
 * Red-List / favorite ids (stored canonically) into the ids that actually
 * exist in cardsOrder.
 *
 *   - Layered deck entry: map(entry.parent_card_id → entry.id)
 *   - Normal entry:       map(entry.id → entry.id)
 */
export function buildCanonicalToPlayableMap(
  deck: ReadonlyArray<{ id: string; parent_card_id?: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const card of deck) {
    if (!card?.id) continue;
    const canonical = card.parent_card_id || card.id;
    if (!map.has(canonical)) map.set(canonical, card.id);
  }
  return map;
}

/**
 * Translate canonical status ids into playable entry ids.
 *
 * A partial red selection is returned as a deduplicated priority list. When
 * every playable entry in the current deck is already selected, returning an
 * empty list disables pointless priority/reinjection work for a red-only deck.
 */
export function mapCanonicalIdsToPlayable(
  canonicalIds: ReadonlyArray<string>,
  canonicalToPlayable: ReadonlyMap<string, string>,
): string[] {
  const seenPlayable = new Set<string>();
  const mapped: string[] = [];

  for (const canonicalId of canonicalIds) {
    const playableId = canonicalToPlayable.get(canonicalId);
    if (!playableId || seenPlayable.has(playableId)) continue;
    seenPlayable.add(playableId);
    mapped.push(playableId);
  }

  const allPlayableIds = new Set(canonicalToPlayable.values());
  const coversWholeDeck =
    allPlayableIds.size > 0 &&
    seenPlayable.size === allPlayableIds.size &&
    Array.from(allPlayableIds).every((id) => seenPlayable.has(id));

  return coversWholeDeck ? [] : mapped;
}
