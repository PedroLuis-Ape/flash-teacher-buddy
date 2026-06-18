import {
  GLOBAL_IMPORT_FORMAT,
  GLOBAL_IMPORT_SCHEMA_VERSION,
  createOfficialGlobalImportExample,
} from "./schema/globalImportSchema";
import { createGlobalImportManifest, type GlobalImportManifest } from "./manifest";
import {
  buildPromptConfiguration,
  makeGlobalImportRequestId,
  type CanonicalPromptOptions,
} from "./promptConfiguration";

export type { CanonicalPromptOptions, PromptFolderConfig } from "./promptConfiguration";

export interface CanonicalPromptBundle {
  requestId: string;
  prompt: string;
  template: string;
  manifest: GlobalImportManifest;
}

function templateOf(requestId: string, config: ReturnType<typeof buildPromptConfiguration>) {
  return {
    format: GLOBAL_IMPORT_FORMAT,
    schema_version: GLOBAL_IMPORT_SCHEMA_VERSION,
    request_id: requestId,
    package: {
      title: config.title,
      description: config.description,
      study_settings: config.study_settings,
      expected_folder_count: config.expected_folder_count,
      expected_list_count: config.expected_list_count,
      expected_card_count: config.expected_card_count,
      folders: config.folders.map((folder) => ({
        title: folder.title,
        description: null,
        order_index: folder.order_index,
        expected_list_count: folder.expected_list_count,
        expected_card_count: folder.expected_card_count,
        lists: folder.lists.map((list) => ({
          title: list.title,
          description: null,
          order_index: list.order_index,
          expected_card_count: list.expected_card_count,
          cards: [],
        })),
      })),
    },
  };
}

export function buildCanonicalGlobalImportPrompt(options: CanonicalPromptOptions): CanonicalPromptBundle {
  const requestId = options.requestId ?? makeGlobalImportRequestId();
  const config = buildPromptConfiguration(options);
  const manifest = createGlobalImportManifest(requestId, config);
  const template = JSON.stringify(templateOf(requestId, config), null, 2);
  const cardShape = JSON.stringify(
    createOfficialGlobalImportExample(requestId).package.folders[0].lists[0].cards[0],
    null,
    2,
  );
  const structure = config.folders.map((folder) => ({
    title: folder.title,
    order_index: folder.order_index,
    expected_list_count: folder.expected_list_count,
    expected_card_count: folder.expected_card_count,
    lists: folder.lists,
  }));
  const constraints = {
    output: "JSON_ONLY",
    markdown: false,
    request_id: "SAME_AS_TEMPLATE",
    editable_paths: ["package.folders[*].lists[*].cards"],
    card_type: "normal",
    preserve_structure: true,
    preserve_order: true,
    exact_counts: true,
    required_card_fields: ["type", "term", "translation"],
    examples: options.includeExamples !== false,
    explanations: options.includeExplanations !== false,
    duplicate_pairs_allowed: options.allowRepetitions === true,
    internal_count_review: true,
  };
  const context = {
    theme: options.theme || null,
    level: options.level || null,
    additional_instructions: options.extraInstructions?.trim() || null,
    structure,
    total_cards: config.expected_card_count,
  };
  const prompt = [
    "APE_GLOBAL_IMPORT_CONTENT_REQUEST",
    `PROTOCOL=${GLOBAL_IMPORT_FORMAT}@${GLOBAL_IMPORT_SCHEMA_VERSION}`,
    `REQUEST_ID=${requestId}`,
    `CONTEXT=${JSON.stringify(context, null, 2)}`,
    `CONSTRAINTS=${JSON.stringify(constraints, null, 2)}`,
    `CARD_SCHEMA=${cardShape}`,
    `JSON_TEMPLATE=${template}`,
  ].join("\n\n");
  return { requestId, prompt, template, manifest };
}
