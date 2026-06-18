import { buildCanonicalGlobalImportPrompt } from "./canonicalPrompt";
import { saveGlobalImportManifest } from "./manifest";
import { createOfficialGlobalImportExample } from "./schema/globalImportSchema";
import type { GlobalImportDestinationMode } from "./destinationModes";

export interface GlobalImportPromptFolderConfig {
  name: string;
  lists: Array<{ name: string; cardCount: number }>;
}

export interface GlobalImportPromptOptions {
  mode: GlobalImportDestinationMode;
  destinationFolderName?: string;
  packageName: string;
  sourceLanguage: string;
  targetLanguage: string;
  level?: string;
  theme: string;
  folders: GlobalImportPromptFolderConfig[];
  includeExamples?: boolean;
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
    sourceLanguage: options.sourceLanguage,
    targetLanguage: options.targetLanguage,
    level: options.level,
    theme: options.theme,
    folders: options.folders,
    includeExamples: options.includeExamples,
    includeExplanations: true,
    allowRepetitions: options.allowRepetitions,
    extraInstructions: options.extraInstructions,
  });
  saveGlobalImportManifest(bundle.manifest);
  return bundle.prompt;
}
