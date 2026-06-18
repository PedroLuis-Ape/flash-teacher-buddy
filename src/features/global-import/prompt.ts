import { buildAdvancedCsvPrompt } from "./advancedCsvPrompt";
import { GLOBAL_IMPORT_CSV_HEADER } from "./csvContract";
import type { GlobalImportDestinationMode } from "./destinationModes";
import type { GlobalImportStudySettings } from "./schema/globalImportSchema";

export interface GlobalImportPromptFolderConfig {
  name: string;
  lists: Array<{ name: string; cardCount: number }>;
}

export interface GlobalImportPromptOptions {
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
  folders: GlobalImportPromptFolderConfig[];
  includeExamples?: boolean;
  includeExplanations?: boolean;
  includeTags?: boolean;
  allowRepetitions?: boolean;
  extraInstructions?: string;
}

export function getOfficialGlobalImportExample(): string {
  return [
    GLOBAL_IMPORT_CSV_HEADER,
    '"Viagens","Aeroporto","Where is the boarding gate?","Onde fica o portão de embarque?"',
  ].join("\n");
}

export function buildGlobalImportPrompt(options: GlobalImportPromptOptions): string {
  const folders = options.mode === "from-file" ? options.folders : [{
    name: options.destinationFolderName?.trim() || "Destino escolhido no aplicativo",
    lists: options.folders.flatMap((folder) => folder.lists),
  }];
  const preferences = [
    options.includeExamples ? "Inclua exemplos quando forem úteis." : "",
    options.includeExplanations ? "Inclua explicações curtas quando forem úteis." : "",
    options.extraInstructions?.trim() || "",
  ].filter(Boolean).join(" ");
  return buildAdvancedCsvPrompt({
    packageName: options.packageName,
    sourceLanguage: options.sourceLanguage,
    targetLanguage: options.targetLanguage,
    level: options.level,
    theme: options.theme,
    folders,
    extraInstructions: preferences,
  });
}
