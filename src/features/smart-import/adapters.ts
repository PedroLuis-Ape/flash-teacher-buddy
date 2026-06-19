import type { GlobalImportPackage } from "@/features/global-import/schema";
import type {
  SmartCard,
  SmartImportList,
  SmartImportPackage,
  SmartLayer,
  SmartNormalCard,
  SmartWordHint,
} from "./schema";

export interface SmartLocalImportResult {
  cards: SmartNormalCard[];
  layered: Array<{ groupTitle: string; layers: SmartLayer[] }>;
  glossary: SmartImportList["glossary"];
  settings: Pick<SmartImportList, "front_language" | "back_language" | "primary_side" | "study_type" | "label_a" | "label_b" | "tts_enabled">;
}

export function flattenSmartCards(cards: SmartCard[]): SmartNormalCard[] {
  const flattened: SmartNormalCard[] = [];
  for (const card of cards) {
    if (card.type === "normal") {
      flattened.push(card);
      continue;
    }
    card.layers.forEach((layer, index) => {
      flattened.push({
        type: "normal",
        ...layer,
        key: layer.key ?? `${card.key ?? card.group_title}:layer:${index}`,
        context_tag: layer.context_tag ?? card.group_title,
      });
    });
  }
  return flattened;
}

export function smartListToLocalResult(list: SmartImportList): SmartLocalImportResult {
  return {
    cards: list.cards.filter((card): card is SmartNormalCard => card.type === "normal"),
    layered: list.cards
      .filter((card) => card.type === "layered")
      .map((card) => ({ groupTitle: card.group_title, layers: card.layers })),
    glossary: list.glossary,
    settings: {
      front_language: list.front_language,
      back_language: list.back_language,
      primary_side: list.primary_side,
      study_type: list.study_type,
      label_a: list.label_a,
      label_b: list.label_b,
      tts_enabled: list.tts_enabled,
    },
  };
}

function wordHintToLegacy(hint: SmartWordHint) {
  return {
    text: hint.text,
    translation: hint.translation,
    note: hint.note ?? undefined,
    side: hint.side,
    startIndex: hint.start_index,
    endIndex: hint.end_index,
  };
}

function cardMetadata(card: SmartNormalCard, list: SmartImportList, group?: { title: string; index: number; key?: string | null }) {
  return {
    app_piteco_contract: "2.0",
    front_language: list.front_language,
    back_language: list.back_language,
    primary_side: list.primary_side,
    study_type: list.study_type,
    label_a: list.label_a ?? null,
    label_b: list.label_b ?? null,
    tts_enabled: list.tts_enabled,
    smart_card_key: card.key ?? null,
    word_hints: card.word_hints?.map(wordHintToLegacy) ?? [],
    detailed_explanation: card.detailed_explanation ?? null,
    usage_notes: card.usage_notes ?? null,
    common_mistakes: card.common_mistakes ?? null,
    short_observation: card.short_observation ?? null,
    context_tag: card.context_tag ?? null,
    tags: card.tags ?? [],
    layer_group: group ? {
      title: group.title,
      index: group.index,
      key: group.key ?? null,
    } : null,
  };
}

/**
 * Compatibility projection used by the existing destination planner and
 * preview components. Rich data remains available in SmartImportPackage and
 * is persisted by the v2 transactional RPC.
 */
export function smartImportToLegacyPackage(value: SmartImportPackage): GlobalImportPackage {
  return {
    schema: "appteco-global-import",
    version: 1,
    package: {
      name: value.package.name,
      source_language: value.package.source_language ?? value.package.folders[0]?.lists[0]?.front_language,
      target_language: value.package.target_language ?? value.package.folders[0]?.lists[0]?.back_language,
      level: value.package.level ?? undefined,
      theme: value.package.theme ?? undefined,
      folders: value.package.folders.map((folder) => ({
        name: folder.name,
        description: folder.description ?? undefined,
        expected_cards: folder.lists.reduce((sum, list) => sum + flattenSmartCards(list.cards).length, 0),
        lists: folder.lists.map((list) => {
          const cards = list.cards.flatMap((card) => {
            if (card.type === "normal") {
              return [{
                front: card.front,
                back: card.back,
                hint: card.hint ?? undefined,
                context_tag: card.context_tag ?? undefined,
                example: card.example ?? undefined,
                example_translation: card.example_translation ?? undefined,
                tags: card.tags ?? undefined,
                metadata: cardMetadata(card, list),
              }];
            }
            return card.layers.map((layer, index) => ({
              front: layer.front,
              back: layer.back,
              hint: layer.hint ?? undefined,
              context_tag: layer.context_tag ?? card.group_title,
              example: layer.example ?? undefined,
              example_translation: layer.example_translation ?? undefined,
              tags: layer.tags ?? undefined,
              metadata: cardMetadata({ type: "normal", ...layer }, list, {
                title: card.group_title,
                index,
                key: card.key,
              }),
            }));
          });
          return {
            name: list.name,
            description: list.description ?? undefined,
            expected_cards: cards.length,
            cards,
          };
        }),
      })),
    },
  };
}

export function firstSmartList(value: SmartImportPackage): SmartImportList | null {
  return value.package.folders[0]?.lists[0] ?? null;
}
