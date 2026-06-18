import { buildCanonicalGlobalImportPrompt } from "./canonicalPrompt";
import { saveGlobalImportManifest } from "./manifest";
import { createOfficialGlobalImportExample, type GlobalImportStudySettings } from "./schema/globalImportSchema";
import type { GlobalImportDestinationMode } from "./destinationModes";

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
  return JSON.stringify(createOfficialGlobalImportExample(), null, 2);
}

export function buildGlobalImportPrompt(options: GlobalImportPromptOptions): string {
  const bundle = buildCanonicalGlobalImportPrompt({
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
    extraInstructions: options.extraInstructions,
  });
  saveGlobalImportManifest(bundle.manifest);
  return bundle.prompt;
}
