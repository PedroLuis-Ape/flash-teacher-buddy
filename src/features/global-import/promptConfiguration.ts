import type { GlobalImportDestinationMode } from "./destinationModes";
import type { GlobalImportStudySettings } from "./schema/globalImportSchema";
import type { GlobalImportManifestConfiguration } from "./manifest";

export interface PromptFolderConfig {
  name: string;
  lists: Array<{ name: string; cardCount: number }>;
}

export interface CanonicalPromptOptions {
  mode: GlobalImportDestinationMode;
  destinationFolderName?: string;
  packageName: string;
  description?: string;
  studyType?: GlobalImportStudySettings["study_type"];
  sourceLanguage: string;
  targetLanguage: string;
  labelA?: string;
  labelB?: string;
  ttsEnabled?: boolean;
  level?: string;
  theme: string;
  folders: PromptFolderConfig[];
  includeExamples?: boolean;
  includeExplanations?: boolean;
  allowRepetitions?: boolean;
  extraInstructions?: string;
  requestId?: string;
}

export function makeGlobalImportRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === "x" ? random : (random & 3) | 8).toString(16);
  });
}

export function effectivePromptFolders(options: CanonicalPromptOptions): PromptFolderConfig[] {
  if (options.mode === "from-file") return options.folders;
  return [{
    name: options.destinationFolderName?.trim() || "Destino escolhido no aplicativo",
    lists: options.folders.flatMap((folder) => folder.lists),
  }];
}

export function buildPromptConfiguration(
  options: CanonicalPromptOptions,
): GlobalImportManifestConfiguration {
  const folders = effectivePromptFolders(options);
  const listCount = folders.reduce((sum, folder) => sum + folder.lists.length, 0);
  const cardCount = folders.reduce(
    (sum, folder) => sum + folder.lists.reduce((listSum, list) => listSum + list.cardCount, 0),
    0,
  );
  const studySettings: GlobalImportStudySettings = {
    study_type: options.studyType ?? "language",
    lang_a: options.sourceLanguage,
    lang_b: options.targetLanguage,
    labels_a: options.labelA?.trim() || options.sourceLanguage,
    labels_b: options.labelB?.trim() || options.targetLanguage,
    tts_enabled: options.ttsEnabled ?? true,
  };

  return {
    title: options.packageName,
    description: options.description?.trim() || null,
    study_settings: studySettings,
    expected_folder_count: folders.length,
    expected_list_count: listCount,
    expected_card_count: cardCount,
    folders: folders.map((folder, folderIndex) => ({
      title: folder.name,
      order_index: folderIndex,
      expected_list_count: folder.lists.length,
      expected_card_count: folder.lists.reduce((sum, list) => sum + list.cardCount, 0),
      lists: folder.lists.map((list, listIndex) => ({
        title: list.name,
        order_index: listIndex,
        expected_card_count: list.cardCount,
      })),
    })),
  };
}
