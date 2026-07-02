export interface ListSpecialCandidate {
  id: string;
  parent_card_id?: string | null;
  deleted_at?: string | null;
}

export interface ListSpecialPlan {
  eligibleIds: string[];
  eligibleCount: number;
  standaloneCount: number;
  layerCount: number;
  aggregatorCount: number;
}

/**
 * Returns the real study units that should enter the Special queue.
 *
 * Standalone cards are included once. Layer rows are included individually.
 * Principal rows that only aggregate layers are excluded because they are not
 * playable cards and would create a duplicate/artificial Special entry.
 */
export function buildListSpecialPlan(cards: readonly ListSpecialCandidate[]): ListSpecialPlan {
  const activeCards = cards.filter((card) => Boolean(card?.id) && !card.deleted_at);
  const parentIds = new Set(
    activeCards
      .map((card) => card.parent_card_id)
      .filter((id): id is string => Boolean(id)),
  );

  const seen = new Set<string>();
  const eligibleIds: string[] = [];
  let standaloneCount = 0;
  let layerCount = 0;
  let aggregatorCount = 0;

  for (const card of activeCards) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);

    const isLayer = Boolean(card.parent_card_id);
    const isAggregator = !isLayer && parentIds.has(card.id);

    if (isAggregator) {
      aggregatorCount += 1;
      continue;
    }

    eligibleIds.push(card.id);
    if (isLayer) layerCount += 1;
    else standaloneCount += 1;
  }

  return {
    eligibleIds,
    eligibleCount: eligibleIds.length,
    standaloneCount,
    layerCount,
    aggregatorCount,
  };
}

export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const safeSize = Math.max(1, Math.floor(size));
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += safeSize) {
    chunks.push(items.slice(index, index + safeSize));
  }
  return chunks;
}
