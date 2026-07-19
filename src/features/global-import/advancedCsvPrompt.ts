import { buildUniversalGlobalImportPrompt } from "./universalPrompt";

export interface AdvancedCsvPromptOptions {
  packageName: string;
  sourceLanguage: string;
  targetLanguage: string;
  level?: string;
  theme: string;
  extraInstructions?: string;
  folders: Array<{ name: string; lists: Array<{ name: string; cardCount: number }> }>;
}

export function buildAdvancedCsvPrompt(options: AdvancedCsvPromptOptions): string {
  const structure = options.folders.flatMap((folder) => [
    `Pasta: ${folder.name}`,
    ...folder.lists.map((list) => `Lista: ${list.name}; quantidade: ${list.cardCount}`),
  ]).join("\n");
  const request = [
    `Pacote: ${options.packageName}`,
    `Tema: ${options.theme}`,
    `Frente: ${options.sourceLanguage}`,
    `Verso: ${options.targetLanguage}`,
    `Nível: ${options.level || "não informado"}`,
    structure,
    options.extraInstructions?.trim() || "",
  ].filter(Boolean).join("\n");
  return `${buildUniversalGlobalImportPrompt()}\n\nMODO AVANÇADO JSON-FIRST\nO pedido abaixo já foi fornecido. Gere o arquivo JSON agora, sem fazer a pergunta inicial. CSV continua aceito apenas nos uploads operacionais explícitos do aplicativo.\n\nPEDIDO DO USUÁRIO\n${request}`;
}
