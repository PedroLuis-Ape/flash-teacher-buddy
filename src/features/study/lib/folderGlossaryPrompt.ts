import { buildCompleteFolderGlossaryContract } from "./glossaryPromptContracts";

export interface FolderGlossaryPromptOptions {
  folderTitle: string;
  labelA: string;
  labelB: string;
}

const safeLabel = (value: string, fallback: string) => value.trim() || fallback;

export function buildFolderGlossaryAiPrompt({
  folderTitle,
  labelA,
  labelB,
}: FolderGlossaryPromptOptions): string {
  return buildCompleteFolderGlossaryContract(
    safeLabel(folderTitle, "Pasta sem nome"),
    safeLabel(labelA, "Lado A"),
    safeLabel(labelB, "Lado B"),
  );
}
