import { SMART_IMPORT_SCHEMA, SMART_IMPORT_VERSION } from "./schema";

export interface SmartImportPromptOptions {
  packageName?: string;
  folderName?: string;
  listName?: string;
  languageA?: string;
  languageB?: string;
  theme?: string;
  level?: string;
  cardCount?: number;
  includeGlobalGlossary?: boolean;
  includeContextGlossary?: boolean;
  includeDetailedExplanations?: boolean;
  includeUsageNotes?: boolean;
  includeCommonMistakes?: boolean;
  includeLayeredCards?: boolean;
  outputFormat?: "json" | "csv" | "text";
  extraInstructions?: string;
}

const enabled = (condition: boolean | undefined, line: string) => condition ? line : "";

export function buildSmartImportPrompt(options: SmartImportPromptOptions = {}) {
  const format = options.outputFormat ?? "json";
  const languageA = options.languageA || "idioma do Lado A";
  const languageB = options.languageB || "idioma do Lado B";
  const contentRules = [
    "Gere cards normais.",
    enabled(options.includeGlobalGlossary, "Inclua glossário global da lista com palavras e expressões úteis."),
    enabled(options.includeContextGlossary, "Inclua word_hints por card para palavras e expressões cujo significado depende daquela frase."),
    enabled(options.includeDetailedExplanations, "Inclua detailed_explanation nos cards que precisarem de explicação gramatical ou contextual."),
    enabled(options.includeUsageNotes, "Inclua usage_notes com restrições e situações de uso."),
    enabled(options.includeCommonMistakes, "Inclua common_mistakes com erros frequentes do aluno."),
    enabled(options.includeLayeredCards, "Inclua cards do tipo layered quando houver várias frases jogáveis sob um mesmo grupo."),
  ].filter(Boolean);

  const noInvent = [
    !options.includeGlobalGlossary ? "Não crie glossário global." : "",
    !options.includeContextGlossary ? "Não crie word_hints." : "",
    !options.includeDetailedExplanations ? "Não crie detailed_explanation." : "",
    !options.includeUsageNotes ? "Não crie usage_notes." : "",
    !options.includeCommonMistakes ? "Não crie common_mistakes." : "",
    !options.includeLayeredCards ? "Não crie cards layered." : "",
  ].filter(Boolean);

  if (format === "csv") return buildSmartCsvPrompt(options, languageA, languageB, contentRules, noInvent);
  if (format === "text") return buildSmartTextPrompt(options, languageA, languageB, contentRules, noInvent);

  return `Você gera pacotes estruturados para o App Piteco.

OBJETIVO
Crie ${options.cardCount ?? "a quantidade solicitada de"} flashcards sobre ${options.theme || "o tema informado pelo usuário"}${options.level ? `, nível ${options.level}` : ""}.
Lado A: ${languageA}.
Lado B: ${languageB}.

RECURSOS ATIVADOS
${contentRules.map((line) => `- ${line}`).join("\n")}

RECURSOS DESATIVADOS
${noInvent.map((line) => `- ${line}`).join("\n") || "- Nenhum."}

REGRA DE CAMADAS
Glossário contextual e cards agrupados são recursos diferentes.
- Glossário contextual: because, of e because of podem coexistir como entradas independentes. Uma expressão maior nunca apaga palavras menores.
- Card layered: group_title é apenas o nome do grupo; somente as frases em layers são jogáveis.

FORMATO DE SAÍDA
Responda exclusivamente com JSON válido, sem markdown e sem comentários.
Use schema "${SMART_IMPORT_SCHEMA}" e version "${SMART_IMPORT_VERSION}".
Use exatamente a estrutura abaixo, omitindo campos opcionais sem conteúdo:
{
  "schema": "${SMART_IMPORT_SCHEMA}",
  "version": "${SMART_IMPORT_VERSION}",
  "package": {
    "name": ${JSON.stringify(options.packageName || "Pacote de flashcards")},
    "source_language": ${JSON.stringify(languageA)},
    "target_language": ${JSON.stringify(languageB)},
    "folders": [
      {
        "name": ${JSON.stringify(options.folderName || "Pasta")},
        "lists": [
          {
            "name": ${JSON.stringify(options.listName || "Principal")},
            "front_language": ${JSON.stringify(languageA)},
            "back_language": ${JSON.stringify(languageB)},
            "primary_side": "a",
            "study_type": "language",
            "tts_enabled": true,
            "glossary": [
              { "term": "because of", "translation": "por causa de", "side": "A", "note": "expressão causal", "active": true }
            ],
            "cards": [
              {
                "type": "normal",
                "key": "card-1",
                "front": "It happened because of the rain.",
                "back": "Isso aconteceu por causa da chuva.",
                "hint": "Observe a expressão because of.",
                "detailed_explanation": "Because of é seguido por substantivo ou pronome.",
                "usage_notes": "Use para indicar causa.",
                "common_mistakes": "Não use because of antes de uma oração completa.",
                "word_hints": [
                  { "side": "A", "text": "because", "translation": "porque", "occurrence": "all" },
                  { "side": "A", "text": "of", "translation": "de", "occurrence": "all" },
                  { "side": "A", "text": "because of", "translation": "por causa de", "note": "expressão completa", "occurrence": "all" }
                ]
              },
              {
                "type": "layered",
                "key": "group-look-up",
                "group_title": "look up",
                "layers": [
                  { "front": "I looked up the word.", "back": "Eu pesquisei a palavra." },
                  { "front": "Things are looking up.", "back": "As coisas estão melhorando." }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}

REGRAS DE QUALIDADE
- Cada card normal precisa de front e back.
- Cada grupo layered precisa de pelo menos duas layers.
- word_hints devem corresponder literalmente a trechos existentes no lado indicado.
- Não duplique o mesmo card na mesma lista.
- Preserve exatamente os nomes de pacote, pasta e lista fornecidos.
- Não escreva declared_totals; o aplicativo calculará automaticamente.
${options.extraInstructions?.trim() ? `\nINSTRUÇÕES ADICIONAIS\n${options.extraInstructions.trim()}` : ""}`;
}

function buildSmartCsvPrompt(
  options: SmartImportPromptOptions,
  languageA: string,
  languageB: string,
  rules: string[],
  noInvent: string[],
) {
  return `Você gera CSV inteligente para o App Piteco.
Responda somente com CSV UTF-8 válido, sem markdown.
Lado A: ${languageA}. Lado B: ${languageB}.
${rules.join(" ")} ${noInvent.join(" ")}

Cabeçalho obrigatório:
record_type,folder_name,list_name,record_key,parent_key,front_language,back_language,side,front,back,hint,detailed_explanation,usage_notes,common_mistakes,note,active,group_title

Tipos de registro:
- card: front/back formam um card normal. record_key é recomendado.
- glossary: front é o termo e back é a tradução; side indica A ou B.
- word_hint: parent_key aponta para record_key do card; front é o trecho e back é a tradução.
- layer_group: record_key identifica o grupo e group_title contém o título.
- layer: parent_key aponta para o grupo; front/back formam a frase jogável.

Regras:
- Use aspas em células com vírgulas, aspas ou quebras de linha.
- Escape aspas internas duplicando-as.
- because, of e because of devem ser três linhas independentes quando as três entradas forem solicitadas.
- Não use layer_group/layer se cards agrupados não estiverem ativados.
- Não use glossary ou word_hint se esses recursos não estiverem ativados.
- Pasta: ${options.folderName || "Pasta"}. Lista: ${options.listName || "Principal"}.
${options.extraInstructions?.trim() || ""}`;
}

function buildSmartTextPrompt(
  options: SmartImportPromptOptions,
  languageA: string,
  languageB: string,
  rules: string[],
  noInvent: string[],
) {
  return `Você gera texto estruturado para o importador do App Piteco.
Responda somente com texto puro, sem markdown.
Lado A: ${languageA}. Lado B: ${languageB}.
${rules.join(" ")} ${noInvent.join(" ")}

Formato:
${options.includeGlobalGlossary ? `=== GLOSSÁRIO GLOBAL ===
because / porque
of / de
because of / por causa de

` : ""}=== CARDS ===
It happened because of the rain. / Isso aconteceu por causa da chuva.${options.includeDetailedExplanations ? " [Because of indica causa e é seguido por substantivo.]" : ""}
${options.includeLayeredCards ? `
[CAMADAS]
look up
I looked up the word. / Eu pesquisei a palavra.
Things are looking up. / As coisas estão melhorando.
` : ""}
Regras:
- Use exatamente espaço, barra, espaço entre os lados.
- Cada entrada ocupa uma linha.
- O texto simples preserva cards, glossário global, dica final e cards agrupados.
- Para glossário contextual por frase e campos detalhados completos, prefira JSON 2.0.
${options.extraInstructions?.trim() || ""}`;
}
