import type { GlobalImportCard, GlobalImportList, GlobalImportPackage } from "@/features/global-import/schema";
import {
  smartImportPackageSchema,
  type SmartCard,
  type SmartImportList,
  type SmartImportPackage,
  type SmartLayer,
  type SmartNormalCard,
  type SmartWordHint,
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

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function wordHintToLegacy(hint: SmartWordHint) {
  return {
    text: hint.text,
    translation: hint.translation,
    note: hint.note ?? undefined,
    side: hint.side,
    occurrence: hint.occurrence,
    startIndex: hint.start_index,
    endIndex: hint.end_index,
  };
}

function legacyWordHints(value: unknown): SmartWordHint[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value.flatMap((item) => {
    const hint = recordOf(item);
    const text = optionalString(hint?.text);
    const translation = optionalString(hint?.translation);
    if (!text || !translation) return [];
    const rawOccurrence = hint?.occurrence;
    const occurrence: number | "all" = typeof rawOccurrence === "number"
      ? rawOccurrence
      : "all";
    const start = hint?.start_index ?? hint?.startIndex;
    const end = hint?.end_index ?? hint?.endIndex;
    return [{
      text,
      translation,
      note: optionalString(hint?.note),
      side: hint?.side === "B" ? "B" as const : "A" as const,
      occurrence,
      start_index: typeof start === "number" ? start : undefined,
      end_index: typeof end === "number" ? end : undefined,
    }];
  });
  return result.length ? result : undefined;
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

function directionFromLegacyCard(card?: GlobalImportCard) {
  const metadata = recordOf(card?.metadata);
  const front = optionalString(metadata?.front_language);
  const back = optionalString(metadata?.back_language);
  return front && back ? { front, back, metadata } : null;
}

export function legacyPackageToSmartImport(value: GlobalImportPackage): SmartImportPackage {
  const fallbackFront = value.package.source_language ?? "en";
  const fallbackBack = value.package.target_language ?? "pt-BR";

  return smartImportPackageSchema.parse({
    schema: "app-piteco-super-import",
    version: "2.0",
    package: {
      name: value.package.name,
      source_language: value.package.source_language ?? null,
      target_language: value.package.target_language ?? null,
      level: value.package.level ?? null,
      theme: value.package.theme ?? null,
      folders: value.package.folders.map((folder) => ({
        name: folder.name,
        description: folder.description ?? null,
        lists: folder.lists.map((list) => {
          const direction = directionFromLegacyCard(list.cards[0]);
          const metadata = direction?.metadata ?? recordOf(list.cards[0]?.metadata);
          return {
            name: list.name,
            description: list.description ?? null,
            front_language: direction?.front ?? fallbackFront,
            back_language: direction?.back ?? fallbackBack,
            primary_side: metadata?.primary_side === "b" ? "b" : "a",
            study_type: optionalString(metadata?.study_type) ?? "language",
            label_a: optionalString(metadata?.label_a),
            label_b: optionalString(metadata?.label_b),
            tts_enabled: typeof metadata?.tts_enabled === "boolean" ? metadata.tts_enabled : true,
            glossary: [],
            cards: list.cards.map((card) => {
              const cardMeta = recordOf(card.metadata);
              return {
                type: "normal" as const,
                front: card.front,
                back: card.back,
                hint: card.hint ?? null,
                example: card.example ?? null,
                example_translation: card.example_translation ?? null,
                detailed_explanation: optionalString(cardMeta?.detailed_explanation),
                usage_notes: optionalString(cardMeta?.usage_notes),
                common_mistakes: optionalString(cardMeta?.common_mistakes),
                short_observation: optionalString(cardMeta?.short_observation),
                context_tag: card.context_tag ?? optionalString(cardMeta?.context_tag),
                tags: Array.isArray(card.tags)
                  ? card.tags.filter((tag): tag is string => typeof tag === "string")
                  : [],
                word_hints: legacyWordHints(cardMeta?.word_hints),
              };
            }),
          };
        }),
      })),
    },
  });
}

const normalizedPair = (front: string, back: string) =>
  `${front.trim().toLocaleLowerCase()}\u0000${back.trim().toLocaleLowerCase()}`;

function legacyListSignature(list: GlobalImportList): string {
  return list.cards.map((card) => normalizedPair(card.front, card.back)).join("\u0001");
}

function smartListSignature(list: SmartImportList): string {
  return flattenSmartCards(list.cards)
    .map((card) => normalizedPair(card.front, card.back))
    .join("\u0001");
}

export function smartPackageForEffectiveLegacy(
  source: SmartImportPackage,
  effective: GlobalImportPackage,
): SmartImportPackage {
  const pools = new Map<string, SmartImportList[]>();
  source.package.folders.forEach((folder) => folder.lists.forEach((list) => {
    const signature = smartListSignature(list);
    const pool = pools.get(signature) ?? [];
    pool.push(list);
    pools.set(signature, pool);
  }));

  const folders = effective.package.folders.map((folder) => ({
    name: folder.name,
    description: folder.description ?? null,
    lists: folder.lists.map((legacyList) => {
      const signature = legacyListSignature(legacyList);
      const original = pools.get(signature)?.shift();
      if (!original) {
        throw new Error(`Não foi possível preservar os dados enriquecidos da lista “${legacyList.name}”.`);
      }
      return {
        ...original,
        name: legacyList.name,
        description: legacyList.description ?? original.description,
      };
    }),
  }));

  return smartImportPackageSchema.parse({
    schema: source.schema,
    version: source.version,
    package: {
      ...source.package,
      name: effective.package.name,
      folders,
    },
  });
}

export function firstSmartList(value: SmartImportPackage): SmartImportList | null {
  return value.package.folders[0]?.lists[0] ?? null;
}
