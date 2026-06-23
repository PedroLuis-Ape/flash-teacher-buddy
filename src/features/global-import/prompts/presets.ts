import {
  SMART_IMPORT_SCHEMA,
  SMART_IMPORT_VERSION,
} from "@/features/smart-import/schema";
import type { GlobalImportDestinationMode } from "../destinationModes";

export type GlobalImportAiPreset = "batch" | "detailed" | "complete";

export interface GlobalImportPromptDestinationContext {
  scope: "personal" | "classroom";
  intent: "quick" | "structured";
  destinationMode?: GlobalImportDestinationMode;
  folderName?: string;
  listName?: string;
}

export interface GlobalImportAiPresetDefinition {
  id: GlobalImportAiPreset;
  title: string;
  shortTitle: string;
  description: string;
  badge: string;
  includes: string[];
}

export const GLOBAL_IMPORT_AI_PRESETS: GlobalImportAiPresetDefinition[] = [
  {
    id: "batch",
    title: "Flashcards em lote",
    shortTitle: "Lote simples",
    description: "Cria muitos cards com frente e verso, sem preencher recursos pedagógicos extras automaticamente.",
    badge: "Rápido",
    includes: ["Cards normais", "Pastas e listas", "Camadas quando solicitadas"],
  },
  {
    id: "detailed",
    title: "Lote com explicação detalhada",
    shortTitle: "Com explicações",
    description: "Cria cards enriquecidos com explicações, exemplos, notas de uso e erros comuns quando forem úteis.",
    badge: "Didático",
    includes: ["Explicações", "Exemplos", "Camadas completas"],
  },
  {
    id: "complete",
    title: "Pacote completo + Glossário Global",
    shortTitle: "Completo",
    description: "Cria cards enriquecidos, dicas contextuais e entradas deduplicadas para a Caixa de Glossário central.",
    badge: "Mais completo",
    includes: ["Explicações", "Word hints", "Glossário da conta", "Camadas completas"],
  },
];

function destinationRules(context?: GlobalImportPromptDestinationContext): string[] {
  if (!context) return [];

  const rules = [
    "CONTEXTO DEFINIDO PELO APP PITECO",
    `- Escopo: ${context.scope === "classroom" ? "turma atual" : "biblioteca pessoal"}.`,
    `- Fluxo: ${context.intent === "quick" ? "adicionar a uma lista existente" : "importação estruturada"}.`,
  ];

  if (context.folderName) rules.push(`- Pasta escolhida na interface: ${context.folderName}.`);
  if (context.listName) rules.push(`- Lista escolhida na interface: ${context.listName}.`);

  if (context.intent === "quick") {
    rules.push(
      "- Gere exatamente uma pasta e exatamente uma lista no JSON.",
      "- O aplicativo continuará sendo a autoridade sobre os IDs reais e sobre o destino final.",
    );
  } else if (context.destinationMode === "existing-folder") {
    rules.push("- Organize as listas para serem colocadas dentro da pasta existente escolhida na interface.");
  } else if (context.destinationMode === "new-folder") {
    rules.push("- Organize todas as listas dentro de uma única pasta coerente.");
  } else {
    rules.push("- Preserve no JSON a estrutura de pastas e listas solicitada pelo usuário.");
  }

  return [...rules, ""];
}

function presetRules(preset: GlobalImportAiPreset): string[] {
  if (preset === "batch") {
    return [
      "MODO SELECIONADO: FLASHCARDS EM LOTE",
      "- Crie cards normais com type, front e back.",
      "- Não crie hint, short_observation, detailed_explanation, usage_notes, common_mistakes, example, example_translation, context_tag, tags, word_hints ou glossário.",
      "- Mantenha glossary como array vazio em todas as listas.",
      "- Cards em camadas são permitidos somente quando o usuário pedir camadas ou pedir vários sentidos/usos agrupados para o mesmo termo.",
      "- Em cards em camadas, cada layer deve conter somente front e back, salvo pedido explícito compatível com outro modo.",
    ];
  }

  if (preset === "detailed") {
    return [
      "MODO SELECIONADO: FLASHCARDS COM EXPLICAÇÃO DETALHADA",
      "- Crie front e back e use os campos pedagógicos somente quando acrescentarem valor real.",
      "- Campos permitidos por card ou layer: hint, short_observation, detailed_explanation, usage_notes, common_mistakes, example, example_translation, context_tag e tags.",
      "- O exemplo deve ser diferente do conteúdo principal do card.",
      "- Não repita a mesma explicação em todos os cards e não preencha campos com texto genérico.",
      "- Não crie glossary nem word_hints neste modo; mantenha glossary como array vazio.",
      "- Cards em camadas podem conter explicações e exemplos diferentes em cada layer.",
    ];
  }

  return [
    "MODO SELECIONADO: PACOTE COMPLETO COM GLOSSÁRIO GLOBAL",
    "- Crie cards enriquecidos com explicações, exemplos, notas de uso e erros comuns quando forem pedagogicamente úteis.",
    "- Inclua word_hints para palavras ou chunks que precisem de ajuda contextual dentro de um card ou layer.",
    "- Inclua as entradas destinadas à Caixa de Glossário central em package.folders[].lists[].glossary.",
    "- O App Piteco centraliza e deduplica essas entradas na conta; não crie um objeto de glossário fora das listas.",
    "- Cada identidade composta por side + term + translation deve aparecer uma única vez no pacote, mesmo que o termo apareça em muitos cards ou listas.",
    "- Traduções realmente diferentes do mesmo termo podem aparecer como entradas separadas e serão tratadas como camadas de significado.",
    "- Preserve termos sobrepostos independentes, por exemplo: because, of e because of.",
    "- Cards em camadas devem preservar explicações, exemplos e word_hints específicos de cada layer.",
  ];
}

const STRUCTURE_EXAMPLE = `{
  "schema": "app-piteco-super-import",
  "version": "2.0",
  "declared_totals": {
    "folders": 1,
    "lists": 1,
    "cards": 3,
    "glossary_entries": 1,
    "layered_groups": 1
  },
  "package": {
    "name": "Nome do pacote",
    "source_language": "en",
    "target_language": "pt-BR",
    "level": "A2",
    "theme": "Tema do conteúdo",
    "folders": [
      {
        "name": "Nome da pasta",
        "description": "Descrição opcional",
        "lists": [
          {
            "name": "Nome da lista",
            "description": "Descrição opcional",
            "front_language": "en",
            "back_language": "pt-BR",
            "primary_side": "a",
            "study_type": "language",
            "label_a": "Inglês",
            "label_b": "Português",
            "tts_enabled": true,
            "glossary": [
              {
                "term": "look after",
                "translation": "cuidar de",
                "side": "A",
                "note": "Phrasal verb",
                "active": true
              }
            ],
            "cards": [
              {
                "type": "normal",
                "front": "I look after my brother.",
                "back": "Eu cuido do meu irmão."
              },
              {
                "type": "layered",
                "group_title": "look up",
                "layers": [
                  {
                    "front": "I looked up the word.",
                    "back": "Eu pesquisei a palavra."
                  },
                  {
                    "front": "Things are looking up.",
                    "back": "As coisas estão melhorando."
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}`;

export function buildGlobalImportPresetPrompt(
  preset: GlobalImportAiPreset,
  context?: GlobalImportPromptDestinationContext,
): string {
  return [
    "Você é o gerador oficial de conteúdo estruturado para o Super Importador do App Piteco.",
    "",
    "CONTRATO OBRIGATÓRIO",
    `- schema: ${SMART_IMPORT_SCHEMA}`,
    `- version: ${SMART_IMPORT_VERSION}`,
    "- formato final: um único objeto JSON puro e válido",
    "- o App Piteco validará o documento com um schema estrito antes de gravar qualquer dado",
    "",
    ...destinationRules(context),
    ...presetRules(preset),
    "",
    "REGRAS DE INTERPRETAÇÃO",
    "- O usuário falará naturalmente e não precisa conhecer JSON, nomes de campos ou estrutura interna.",
    "- Preserve nomes de pacote, pastas e listas quando forem informados.",
    "- Quando a estrutura não for informada, organize o conteúdo de forma coerente sem fazer perguntas técnicas.",
    "- Pergunte no máximo uma coisa curta somente quando idioma, direção ou uma contradição real impedir a geração.",
    "- Preserve exatamente a direção dos idiomas solicitada no lado A e no lado B.",
    "- Use códigos de idioma claros, preferencialmente BCP 47, como en, pt-BR, es, fr, de e it.",
    "- Não repita cards nem use frases quase idênticas apenas para completar quantidade.",
    "- Nunca deixe front ou back vazios.",
    "",
    "CARDS NORMAIS E CARDS EM CAMADAS",
    "- Card normal: {\"type\":\"normal\",\"front\":\"...\",\"back\":\"...\"}.",
    "- Card em camadas: {\"type\":\"layered\",\"group_title\":\"...\",\"layers\":[{\"front\":\"...\",\"back\":\"...\"},{\"front\":\"...\",\"back\":\"...\"}]}.",
    "- Um grupo layered precisa ter pelo menos duas layers jogáveis.",
    "- Não use layers para guardar explicações ou exemplos; esses dados pertencem aos campos pedagógicos da própria layer.",
    "- Não agrupe frases sem relação semântica apenas para reduzir a quantidade de cards.",
    "",
    "GLOSSÁRIO CONTEXTUAL",
    "- word_hints é um array por card ou layer.",
    "- Cada item pode usar side, text, translation, note, occurrence, start_index e end_index.",
    "- occurrence pode ser \"all\" ou um índice inteiro não negativo.",
    "- start_index e end_index devem aparecer juntos e end_index precisa ser maior que start_index.",
    "",
    "CONTAGENS",
    "- declared_totals.folders deve ser igual ao número real de pastas.",
    "- declared_totals.lists deve ser igual ao número real de listas.",
    "- declared_totals.glossary_entries deve ser igual ao total real de entradas em todos os arrays glossary.",
    "- declared_totals.layered_groups deve ser igual à quantidade de objetos com type=layered.",
    "- declared_totals.cards representa unidades jogáveis: cada card normal vale 1 e cada layer de um grupo vale 1.",
    "- Conte tudo silenciosamente antes de responder.",
    "",
    "ESTRUTURA DE REFERÊNCIA",
    STRUCTURE_EXAMPLE,
    "",
    "SAÍDA FINAL",
    "- Responda somente com o JSON.",
    "- Não use Markdown nem bloco de código.",
    "- Não escreva introdução, conclusão, observação ou pedido para o usuário fora do JSON.",
    "- Não use comentários dentro do JSON.",
    "- Não use vírgula final.",
    "- Não adicione propriedades fora do contrato 2.0.",
    "- Não entregue mais de um objeto JSON.",
    "",
    "COMPORTAMENTO INICIAL",
    "- Se o usuário enviar apenas este prompt, responda exatamente: Descreva naturalmente o pacote de flashcards que você quer criar.",
    "- Se o usuário enviar este prompt junto com um pedido, gere diretamente o JSON final.",
    "",
    "VALIDAÇÃO SILENCIOSA ANTES DA RESPOSTA",
    "Confirme schema, version, JSON válido, campos permitidos pelo modo, idiomas, direção, nomes, contagens, cards em camadas válidos, glossário válido e ausência de texto fora do JSON.",
  ].join("\n");
}
