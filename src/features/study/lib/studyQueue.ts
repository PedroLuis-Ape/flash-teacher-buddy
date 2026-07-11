import {
  filterCardsForStudyScope,
  resolveStudyScope,
  type StudyScope,
  type StudyScopeCard,
  type StudyScopeSettings,
} from "./studyScopePolicy";

export interface StudyQueueSettings extends StudyScopeSettings {
  mode: "sequential" | "random";
}

export interface BuildStudyQueueInput<TCard extends StudyScopeCard> {
  cards: ReadonlyArray<TCard>;
  favoriteIds: ReadonlyArray<string>;
  redListIds: ReadonlyArray<string>;
  settings: StudyQueueSettings;
  random?: () => number;
}

export interface StudyQueueResult {
  queue: string[];
  scope: StudyScope;
}

function dedupePlayableIds(cards: ReadonlyArray<StudyScopeCard>): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const card of cards) {
    if (!card.id || seen.has(card.id)) continue;
    seen.add(card.id);
    ids.push(card.id);
  }

  return ids;
}

function shuffleFisherYates(ids: string[], random: () => number): string[] {
  const shuffled = [...ids];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomValue = Math.min(Math.max(random(), 0), 0.9999999999999999);
    const swapIndex = Math.floor(randomValue * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function buildStudyQueue<TCard extends StudyScopeCard>({
  cards,
  favoriteIds,
  redListIds,
  settings,
  random = Math.random,
}: BuildStudyQueueInput<TCard>): StudyQueueResult {
  const scope = resolveStudyScope(settings);
  const scopedCards = filterCardsForStudyScope({
    cards,
    favoriteIds,
    redListIds,
    settings,
  });
  const uniqueIds = dedupePlayableIds(scopedCards);

  if (scope === "red" || settings.mode === "sequential") {
    return { queue: uniqueIds, scope };
  }

  return {
    queue: shuffleFisherYates(uniqueIds, random),
    scope,
  };
}
