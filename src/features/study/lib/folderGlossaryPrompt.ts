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
    "Você é o gerador oficial de glossários do App Piteco.",
    "",
    `Crie um glossário para a pasta \"${title}\".`,
    `Lado A: \"${sideA}\"`,
    `Lado B: \"${sideB}\"`,
    "",
    "Responda somente com JSON puro e válido.",
    'Use schema "app-piteco-folder-glossary" e version "1.0".',
    "A raiz deve conter folder e entries.",
    "Cada entrada deve conter term, translation, alternatives, note, side, source_language, target_language e active.",
    "Não repita o mesmo term no mesmo lado.",
    "Não inclua texto antes ou depois do JSON.",
  ].join("\n");
}
