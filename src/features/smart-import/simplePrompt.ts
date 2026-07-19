import { withJsonFileDeliveryContract } from "@/features/import-prompts/deliveryContract";

export interface SimpleFlashcardPromptOptions {
  listName: string;
  sideALabel: string;
  sideBLabel: string;
}

const clean = (value: string, fallback: string) => value.trim() || fallback;

export function buildSimpleFlashcardPrompt(options: SimpleFlashcardPromptOptions): string {
  const listName = clean(options.listName, "Lista atual");
  const sideALabel = clean(options.sideALabel, "Lado A");
  const sideBLabel = clean(options.sideBLabel, "Lado B");

  return withJsonFileDeliveryContract([
    "Você é o gerador oficial de flashcards simples do App Piteco.",
    "",
    "OBJETIVO",
    `Crie flashcards normais para a lista \"${listName}\".`,
    `- Lado A: \"${sideALabel}\"`,
    `- Lado B: \"${sideBLabel}\"`,
    "",
    "CONTRATO OBRIGATÓRIO",
    "- Gere schema app-piteco-super-import e version 2.0.",
    "- Gere uma única pasta e uma única lista com glossary vazio.",
    "- Cada card deve usar type normal, front e back.",
    "- Não gere cards em camadas, glossário, IDs de banco ou campos desconhecidos.",
    "- front e back nunca podem ficar vazios.",
    "- Não repita cards nem use texto fora do JSON.",
    "",
    "EXEMPLO DE ESTRUTURA",
    '{"schema":"app-piteco-super-import","version":"2.0","package":{"name":"Lista atual","folders":[{"name":"Lista atual","lists":[{"name":"Lista atual","front_language":"en","back_language":"pt-BR","primary_side":"a","study_type":"language","glossary":[],"cards":[{"type":"normal","front":"Hello","back":"Olá"}]}]}]}}',
    "",
    "DADOS QUE O USUÁRIO VAI INFORMAR",
    "Tema, texto ou vocabulário: [INFORME AQUI]",
    "Quantidade aproximada: [INFORME AQUI]",
    "Nível do aluno: [INFORME AQUI]",
    "",
    "Depois de receber os dados, gere diretamente o JSON final.",
  ].join("\n"));
}
