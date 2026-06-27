import { folderGlossaryPromptPart1 } from "./folderGlossaryPromptPart1";
import { folderGlossaryPromptPart2 } from "./folderGlossaryPromptPart2";
import { folderGlossaryPromptPart3 } from "./folderGlossaryPromptPart3";
import { folderGlossaryPromptPart4 } from "./folderGlossaryPromptPart4";
import { folderGlossaryPromptPart5 } from "./folderGlossaryPromptPart5";
import { folderGlossaryPromptPart6 } from "./folderGlossaryPromptPart6";

export function folderGlossaryPromptGroupA(title: string, sideA: string, sideB: string): string {
  return [
    folderGlossaryPromptPart1(title, sideA, sideB),
    folderGlossaryPromptPart2(),
    folderGlossaryPromptPart3(),
    folderGlossaryPromptPart4(),
    folderGlossaryPromptPart5(),
    folderGlossaryPromptPart6(),
  ].join("\n\n");
}
