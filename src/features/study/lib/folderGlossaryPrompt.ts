import { appendPreferredJsonFileDelivery } from "@/lib/aiJsonFileDelivery";
import { folderGlossaryPromptGroupA } from "./folderGlossaryPromptGroupA";
import { folderGlossaryPromptGroupB } from "./folderGlossaryPromptGroupB";

export interface FolderGlossaryPromptOptions {
  folderTitle: string;
  labelA: string;
  labelB: string;
}

const clean = (value: string, fallback: string) => value.trim() || fallback;
const filenamePart = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .toLowerCase()
  || "pasta";

export function buildFolderGlossaryAiPrompt(options: FolderGlossaryPromptOptions): string {
  const title = clean(options.folderTitle, "Pasta sem nome");
  const sideA = clean(options.labelA, "Lado A");
  const sideB = clean(options.labelB, "Lado B");
  const prompt = [
    folderGlossaryPromptGroupA(title, sideA, sideB),
    folderGlossaryPromptGroupB(title),
  ].join("\n\n");

  return appendPreferredJsonFileDelivery(
    prompt,
    `app-piteco-glossario-${filenamePart(title)}.json`,
  );
}
