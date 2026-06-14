/**
 * CLARA MASTER P0 — single helper that maps any flashcard-shaped object
 * to its CANONICAL group id, in the legacy world where:
 *   - a layer card has `parent_card_id` set;
 *   - a principal / normal card has `parent_card_id = null`.
 *
 * This is the only identity used by Favorites and Red List checks in the
 * UI (ListDetail, Study, GamesHub). It deliberately does NOT touch
 * `status_group_uid` — that pipeline stays off until the new system flips.
 */
export interface CardLike {
  id?: string | null;
  parent_card_id?: string | null;
  __parentCardId?: string | null;
}

export function resolveLegacyFlashcardGroupId(card: CardLike | null | undefined): string | null {
  if (!card) return null;
  return (
    (card as any).__parentCardId ||
    card.parent_card_id ||
    card.id ||
    null
  );
}