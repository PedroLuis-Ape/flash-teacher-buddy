import {
  GLOBAL_IMPORT_EXAMPLE,
  GLOBAL_IMPORT_SCHEMA,
  GLOBAL_IMPORT_VERSION,
} from "./schema";

export interface GlobalImportPromptFolderConfig {
  name: string;
  lists: Array<{ name: string; cardCount: number }>;
}

export interface GlobalImportPromptOptions {
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
  return JSON.stringify(GLOBAL_IMPORT_EXAMPLE, null, 2);
}

export function buildGlobalImportPrompt(options: GlobalImportPromptOptions): string {
  const folders = options.folders.map((folder, folderIndex) => {
    const lists = folder.lists.map((list, listIndex) => (
      `${folderIndex + 1}.${listIndex + 1}. Lista "${list.name}": exatamente ${list.cardCount} cards.`
    )).join("\n");
    return `${folderIndex + 1}. Pasta "${folder.name}":\n${lists}`;
  }).join("\n\n");

  const fields = ["front", "back"];
  if (options.includeExamples) fields.push("example", "example_translation");
  if (options.includeTags) fields.push("tags");

  return `Você é uma IA especializada em criar pacotes de flashcards compatíveis com o AppPTeco.

TAREFA
Gere um único pacote JSON importável pelo Super Importador Global.

CONFIGURAÇÃO
Nome do pacote: ${options.packageName}
Idioma principal: ${options.sourceLanguage}
Idioma da tradução: ${options.targetLanguage}
Nível: ${options.level || "não informado"}
Tema: ${options.theme}

PASTAS E LISTAS
${folders}

CAMPOS DE CADA CARD
${fields.join(", ")}

REGRAS OBRIGATÓRIAS
1. Use exatamente schema "${GLOBAL_IMPORT_SCHEMA}" e version ${GLOBAL_IMPORT_VERSION}.
2. Crie exatamente as pastas e listas solicitadas.
3. Respeite exatamente a quantidade de cards de cada lista.
4. Coloque cada card somente na pasta e lista corretas.
5. Preserve a ordem declarada.
6. Não omita nem acrescente pastas ou listas.
7. Não deixe front ou back vazios.
8. ${options.allowRepetitions ? "Repetições são permitidas quando fizerem sentido." : "Não repita cards."}
9. Não escreva texto fora do JSON.
10. Não use Markdown, comentários ou crases.
11. Não altere os nomes dos campos.
12. Preencha expected_cards em cada pasta e lista com a contagem real.
13. Revise todas as contagens antes de responder.
${options.extraInstructions?.trim() ? `14. Instruções adicionais: ${options.extraInstructions.trim()}` : ""}

ESTRUTURA OFICIAL DE REFERÊNCIA
${getOfficialGlobalImportExample()}

Entregue somente o pacote JSON final.`;
}
