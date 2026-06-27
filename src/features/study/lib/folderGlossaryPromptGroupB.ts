import { folderGlossaryPromptActive } from "./folderGlossaryPromptActive";
import { folderGlossaryPromptPart9 } from "./folderGlossaryPromptPart9";
import { folderGlossaryPromptPart10 } from "./folderGlossaryPromptPart10";
import { folderGlossaryPromptPart11 } from "./folderGlossaryPromptPart11";
import { folderGlossaryPromptPart12 } from "./folderGlossaryPromptPart12";

export function folderGlossaryPromptGroupB(title: string): string {
  return [
    folderGlossaryPromptActive(),
    folderGlossaryPromptPart9(),
    folderGlossaryPromptPart10(),
    folderGlossaryPromptPart11(),
    folderGlossaryPromptPart12(title),
  ].join("\n\n");
}
