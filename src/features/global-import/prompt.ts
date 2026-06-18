import {
  GLOBAL_IMPORT_SCHEMA,
  GLOBAL_IMPORT_VERSION,
  type GlobalImportPackage,
} from "./schema";
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

function effectiveFolders(options: GlobalImportPromptOptions): GlobalImportPromptFolderConfig[] {
  if (options.mode === "from-file") return options.folders;
  return [{
    name: options.destinationFolderName?.trim() || "Destino escolhido no aplicativo",
    lists: options.folders.flatMap((folder) => folder.lists),
  }];
}

function buildReferencePackage(options: GlobalImportPromptOptions): GlobalImportPackage {
  const folders = effectiveFolders(options);
  return {
    schema: GLOBAL_IMPORT_SCHEMA,
    version: GLOBAL_IMPORT_VERSION,
    package: {
      name: options.packageName,
      source_language: options.sourceLanguage,
      target_language: options.targetLanguage,
      level: options.level,
      theme: options.theme,
      folders: folders.map((folder) => ({
        name: folder.name,
        expected_cards: folder.lists.reduce((sum, list) => sum + list.cardCount, 0),
        lists: folder.lists.map((list) => ({
          name: list.name,
          expected_cards: list.cardCount,
          cards: [{
            front: "<conteúdo no idioma principal>",
            back: "<tradução correspondente>",
            ...(options.includeExamples ? {
              example: "<frase de exemplo>",
              example_translation: "<tradução da frase>",
            } : {}),
            ...(options.includeTags ? { tags: ["<tag opcional>"] } : {}),
          }],
        })),
      })),
    },
  };
}

export function buildGlobalImportPrompt(options: GlobalImportPromptOptions): string {
  const folders = effectiveFolders(options);
  const structure = folders.map((folder, folderIndex) => {
    const lists = folder.lists.map((list, listIndex) => (
      `${folderIndex + 1}.${listIndex + 1}. Lista "${list.name}": exatamente ${list.cardCount} cards.`
    )).join("\n");
    return `${folderIndex + 1}. Pasta "${folder.name}":\n${lists}`;
  }).join("\n\n");

  const totalCards = folders.reduce(
    (folderTotal, folder) => folderTotal + folder.lists.reduce((listTotal, list) => listTotal + list.cardCount, 0),
    0,
  );
  const fields = ["front", "back"];
  if (options.includeExamples) fields.push("example", "example_translation");
  if (options.includeTags) fields.push("tags");

  const destinationRule = options.mode === "from-file"
    ? "Os nomes de pasta declarados abaixo fazem parte da estrutura e devem ser preservados exatamente."
    : `A pasta de destino já foi escolhida no aplicativo${options.destinationFolderName ? `: "${options.destinationFolderName}"` : ""}. Gere somente as listas solicitadas dentro de uma única pasta de transporte. O aplicativo dará prioridade ao destino escolhido na interface.`;

  return `Você é uma IA especializada em criar pacotes de flashcards compatíveis com o AppPTeco.

TAREFA
Gere um único pacote JSON importável pelo Super Importador Global.

MODO DE IMPORTAÇÃO
${options.mode === "existing-folder" ? "Usar uma pasta existente" : options.mode === "new-folder" ? "Criar uma nova pasta única definida pelo usuário" : "Criar a estrutura completa declarada no conteúdo"}
${destinationRule}

CONFIGURAÇÃO
Nome do pacote: ${options.packageName}
Idioma principal: ${options.sourceLanguage}
Idioma da tradução: ${options.targetLanguage}
Nível: ${options.level || "não informado"}
Tema: ${options.theme}
Total obrigatório: ${totalCards} cards

ESTRUTURA SOLICITADA
${structure}

CAMPOS DE CADA CARD
${fields.join(", ")}

REGRAS OBRIGATÓRIAS
1. Use exatamente schema "${GLOBAL_IMPORT_SCHEMA}" e version ${GLOBAL_IMPORT_VERSION}.
2. Respeite exatamente os nomes e as quantidades declaradas.
3. Não misture cards entre listas.
4. Não crie pastas ou listas adicionais.
5. Preserve a ordem declarada.
6. Não deixe front ou back vazios.
7. ${options.allowRepetitions ? "Repetições são permitidas quando fizerem sentido." : "Não repita cards."}
8. Não escreva texto fora do JSON.
9. Não use Markdown, comentários ou crases.
10. Não altere os nomes dos campos.
11. Preencha expected_cards em cada pasta e lista com a contagem real.
12. Revise todas as contagens antes de responder.
${options.extraInstructions?.trim() ? `13. Instruções adicionais: ${options.extraInstructions.trim()}` : ""}

FORMATO DE REFERÊNCIA GERADO A PARTIR DAS ESCOLHAS ATUAIS
${JSON.stringify(buildReferencePackage(options), null, 2)}

Substitua os placeholders pelos cards reais e entregue somente o pacote JSON final.`;
}
