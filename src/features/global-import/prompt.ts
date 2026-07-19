import { buildCanonicalGlobalImportPrompt } from "./canonicalPrompt";
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
  return JSON.stringify({
    format: "ape-global-import",
    schema_version: 1,
    request_id: "00000000-0000-4000-8000-000000000000",
    package: {
      title: "Viagens",
      folders: [{
        title: "Aeroporto",
        lists: [{
          title: "Check-in",
          cards: [{ type: "normal", term: "Where is the boarding gate?", translation: "Onde fica o portão de embarque?" }],
        }],
      }],
    },
  }, null, 2);
}

export function buildGlobalImportPrompt(options: GlobalImportPromptOptions): string {
  const preferences = [
    options.extraInstructions?.trim() || "",
    options.includeTags ? "Use tags somente quando agregarem organização real." : "",
  ].filter(Boolean).join(" ");

  return buildCanonicalGlobalImportPrompt({
    mode: options.mode,
    destinationFolderName: options.destinationFolderName,
    packageName: options.packageName,
    description: options.description,
    studyType: options.studyType,
    sourceLanguage: options.sourceLanguage,
    targetLanguage: options.targetLanguage,
    labelA: options.labelA,
    labelB: options.labelB,
    ttsEnabled: options.ttsEnabled,
    level: options.level,
    theme: options.theme,
    folders: options.folders,
    includeExamples: options.includeExamples,
    includeExplanations: options.includeExplanations,
    allowRepetitions: options.allowRepetitions,
    extraInstructions: preferences,
  }).prompt;
}
