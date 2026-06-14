/**
 * groupPlayableMap — pure mapping from `status_group_uid` to the deck
 * entry-point id used by the study engine (`playableEntryId`).
 *
 * Clara Master Phase 7 contract:
 *   - This map is rebuilt from in-memory cards on every engine init. It is
 *     NEVER persisted. The persistence layer owns only `status_group_uid`
 *     (Phase 2) and `user_flashcard_group_status` (Phase 3).
 *   - The map is stable for the lifetime of a study session, even across
 *     a merge/unmerge that happens between sessions (because the engine
 *     uses the playable entry for the CURRENT deck, not historical state).
 *   - Cards without a `status_group_uid` (e.g. v1 offline snapshots that
 *     have a parent_card_id but no uid yet) are bucketed by
 *     `parent_card_id ?? id`, so the engine never crashes on partial data.
 */

export interface PlayableCard {
  id: string;
  parent_card_id?: string | null;
  status_group_uid?: string | null;
  layer_index?: number | null;
}

export interface GroupPlayableMap {
  /** statusGroupUid (or fallback) → playableEntryId (the engine's deck id). */
  byGroup: Map<string, string>;
  /** Reverse lookup: any card id → the playableEntryId for its group. */
  byCard: Map<string, string>;
}

/**
 * Build the canonical map. The playable entry-point for a group is:
 *   - the layer with `layer_index === 0` if present, else
 *   - the lexicographically smallest id in the group (deterministic tie-break).
 * For non-layered cards (no parent + no other group members), entry = self.
 */
export function buildGroupPlayableMap(cards: ReadonlyArray<PlayableCard>): GroupPlayableMap {
  const buckets = new Map<string, PlayableCard[]>();

  for (const c of cards) {
    if (!c?.id) continue;
    const key = c.status_group_uid ?? c.parent_card_id ?? c.id;
    const arr = buckets.get(key);
    if (arr) arr.push(c);
    else buckets.set(key, [c]);
  }

  const byGroup = new Map<string, string>();
  const byCard = new Map<string, string>();

  for (const [groupKey, members] of buckets) {
    let entry: PlayableCard | undefined;
    // Prefer the explicit layer 0 if any layer has a numeric layer_index.
    for (const m of members) {
      if (typeof m.layer_index === "number" && m.layer_index === 0) {
        entry = m;
        break;
      }
    }
    if (!entry) {
      // Deterministic tie-break: smallest id.
      entry = [...members].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
    }
    const playableId = entry!.id;
    byGroup.set(groupKey, playableId);
    for (const m of members) byCard.set(m.id, playableId);
  }

  return { byGroup, byCard };
}

/** Convenience: resolve a single card to its playable entry id. */
export function playableEntryFor(map: GroupPlayableMap, cardId: string): string | undefined {
  return map.byCard.get(cardId);
}