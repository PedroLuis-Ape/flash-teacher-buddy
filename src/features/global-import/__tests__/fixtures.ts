import {
  globalImportSchema,
  type CanonicalGlobalImportPackage,
} from "../schema/globalImportSchema";
import {
  configurationFromCanonicalPackage,
  createGlobalImportManifest,
  type GlobalImportManifest,
} from "../manifest";

export const TEST_REQUEST_ID = "11111111-1111-4111-8111-111111111111";

interface FixtureOptions {
  folders?: number;
  listsPerFolder?: number;
  cardsPerList?: number;
  requestId?: string;
}

export function makeCanonicalPackage(options: FixtureOptions = {}): CanonicalGlobalImportPackage {
  const folderCount = options.folders ?? 2;
  const listsPerFolder = options.listsPerFolder ?? 2;
  const cardsPerList = options.cardsPerList ?? 3;
  const requestId = options.requestId ?? TEST_REQUEST_ID;
  const folders = Array.from({ length: folderCount }, (_, folderIndex) => ({
    title: `Pasta ${folderIndex + 1}`,
    description: null,
    order_index: folderIndex,
    expected_list_count: listsPerFolder,
    expected_card_count: listsPerFolder * cardsPerList,
    lists: Array.from({ length: listsPerFolder }, (_, listIndex) => ({
      title: `Lista ${folderIndex + 1}.${listIndex + 1}`,
      description: null,
      order_index: listIndex,
      expected_card_count: cardsPerList,
      cards: Array.from({ length: cardsPerList }, (_, cardIndex) => ({
        type: "normal" as const,
        term: `Termo ${folderIndex + 1}.${listIndex + 1}.${cardIndex + 1}`,
        translation: `Tradução ${folderIndex + 1}.${listIndex + 1}.${cardIndex + 1}`,
        hint: null,
        example_text: null,
        example_translation: null,
        detailed_explanation: null,
        usage_notes: null,
        common_mistakes: null,
      })),
    })),
  }));

  return globalImportSchema.parse({
    format: "ape-global-import",
    schema_version: 1,
    request_id: requestId,
    package: {
      title: "Pacote de teste",
      description: null,
      study_settings: {
        study_type: "language",
        lang_a: "en",
        lang_b: "pt-BR",
        labels_a: "English",
        labels_b: "Português",
        tts_enabled: true,
      },
      expected_folder_count: folderCount,
      expected_list_count: folderCount * listsPerFolder,
      expected_card_count: folderCount * listsPerFolder * cardsPerList,
      folders,
    },
  });
}

export function makeManifest(value: CanonicalGlobalImportPackage): GlobalImportManifest {
  return createGlobalImportManifest(
    value.request_id,
    configurationFromCanonicalPackage(value),
  );
}

export function clonePackage(value: CanonicalGlobalImportPackage): any {
  return JSON.parse(JSON.stringify(value));
}
