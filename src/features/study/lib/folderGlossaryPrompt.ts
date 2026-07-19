import { folderGlossaryPromptGroupA } from "./folderGlossaryPromptGroupA";
import { folderGlossaryPromptGroupB } from "./folderGlossaryPromptGroupB";
import { JSON_FILE_DELIVERY_CONTRACT } from "@/features/import-prompts/deliveryContract";

export interface FolderGlossaryPromptOptions {
  folderTitle: string;
  labelA: string;
  labelB: string;
}

const clean = (value: string, fallback: string) => value.trim() || fallback;

export function buildFolderGlossaryAiPrompt(options: FolderGlossaryPromptOptions): string {
  const title = clean(options.folderTitle, "Pasta sem nome");
  const sideA = clean(options.labelA, "Lado A");
  const sideB = clean(options.labelB, "Lado B");

  return [
    JSON_FILE_DELIVERY_CONTRACT,
    folderGlossaryPromptGroupA(title, sideA, sideB),
    folderGlossaryPromptGroupB(title),
  ].join("\n\n");
}
