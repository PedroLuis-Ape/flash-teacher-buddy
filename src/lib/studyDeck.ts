/**
 * prepareLayeredStudyDeck
 * ------------------------------------------------------------------
 * Reorganizes raw flashcards from a list/collection into the playable
 * study deck, collapsing [CAMADAS] groups into a single deck entry.
 *
 * Rules:
 *  - Cards referenced by other cards via `parent_card_id` are
 *    "principals" (aggregator rows / group titles). They are NEVER
 *    playable cards themselves.
 *  - Cards that have `parent_card_id` set are "layers". All layers
 *    sharing the same parent form a group, sorted by `layer_index`.
 *  - For each group, ONLY the first layer enters the deck as an
 *    entry-point. It carries:
 *       __layers: Flashcard[]    // all layers of the group (incl. itself)
 *       __groupTitle: string|null
 *       __parentCardId: string|null
 *  - Cards without parent and without children pass through unchanged.
 *
 * Net effect: a group with N layers contributes ONE item to the deck,
 * matching the historical UX where the player navigates inside the
 * group with "Próxima camada" / "Camada anterior".
 */
export interface RawLayeredCard {
  id: string;
  parent_card_id?: string | null;
  layer_index?: number | null;
  term?: string | null;
  [k: string]: any;
}

export function prepareLayeredStudyDeck<T extends RawLayeredCard>(rawCards: T[]): T[] {
  if (!Array.isArray(rawCards) || rawCards.length === 0) return [];

  const principalById = new Map<string, T>();
  const layersByPrincipal = new Map<string, T[]>();

  for (const c of rawCards) {
    if (c.parent_card_id) {
      const arr = layersByPrincipal.get(c.parent_card_id) ?? [];
      arr.push(c);
      layersByPrincipal.set(c.parent_card_id, arr);
    } else {
      principalById.set(c.id, c);
    }
  }

  for (const arr of layersByPrincipal.values()) {
    arr.sort((a, b) => (a.layer_index ?? 0) - (b.layer_index ?? 0));
  }

  // Track which principal groups we've already emitted (so only the first
  // encountered layer of each group seeds the deck entry).
  const emittedGroup = new Set<string>();
  const deck: T[] = [];

  for (const c of rawCards) {
    // Skip principal/aggregator rows that actually group layers.
    if (!c.parent_card_id && layersByPrincipal.has(c.id)) continue;

    if (c.parent_card_id) {
      const parentId = c.parent_card_id;
      if (emittedGroup.has(parentId)) continue;
      emittedGroup.add(parentId);

      const group = layersByPrincipal.get(parentId) ?? [];
      const principal = principalById.get(parentId);
      const entryPoint = group[0] ?? c;
      deck.push({
        ...(entryPoint as any),
        __layers: group,
        __groupTitle: principal?.term ?? null,
        __parentCardId: parentId,
      });
    } else {
      // Normal standalone card.
      deck.push(c);
    }
  }

  return deck;
}