import type { SpecialExportPackage } from "./protocol";
import {
  SPECIAL_CSV_FORMAT,
  SPECIAL_CSV_HEADER_LINE,
  SPECIAL_CSV_SCHEMA_VERSION,
  serializeSpecialCsvRecord,
  type SpecialCsvRecord,
} from "./csvContract";

export function buildSpecialCsvExport(batch: SpecialExportPackage): string {
  const rows = batch.cards.map((card): SpecialCsvRecord => ({
    format: SPECIAL_CSV_FORMAT,
    schema_version: String(SPECIAL_CSV_SCHEMA_VERSION),
    export_id: batch.export_id,
    card_ref: card.card_ref,
    flashcard_id: card.flashcard_id,
    term: card.term,
    translation: card.translation,
    focus_text: card.focus_text ?? "",
    focus_tag: card.focus_tag ?? "",
    focus_note: card.focus_note ?? "",
    detailed_explanation: "",
    usage_notes: "",
    common_mistakes: "",
    example_1_en: card.example_text ?? "",
    example_1_pt: card.example_translation ?? "",
    example_2_en: "",
    example_2_pt: "",
  }));

  return [SPECIAL_CSV_HEADER_LINE, ...rows.map(serializeSpecialCsvRecord)].join("\r\n");
}

export function buildSpecialCsvPrompt(batch: SpecialExportPackage): string {
  const rules = [
    "Preserve exatamente o cabeçalho, a ordem das colunas e a ordem das linhas.",
    "Preserve sem nenhuma alteração format, schema_version, export_id, card_ref, flashcard_id, term, translation, focus_text, focus_tag e focus_note.",
    "Quando focus_text estiver preenchido, explique obrigatoriamente esse trecho como foco principal. Não escolha outro foco principal.",
    "Quando focus_tag estiver preenchido, use essa categoria para guiar a explicação: grammar, vocabulary, expression, phrasal_verb, pronunciation, translation, natural_usage ou other.",
    "Quando focus_note estiver preenchido, responda diretamente à dificuldade descrita pelo professor/aluno.",
    "Comece detailed_explanation exatamente com 'Expressão-chave: <trecho exato do foco>'. Se focus_text estiver vazio, use a peça-chave inferida.",
    "Quando focus_text estiver vazio e term for uma frase completa, identifique dentro dela a palavra, collocation, phrasal verb ou expressão mais específica e pedagogicamente útil; não explique a frase inteira palavra por palavra quando existir uma peça-chave mais relevante.",
    "Quando o card já for uma palavra ou expressão curta, use o próprio term como expressão-chave. Quando representar uma camada ou sentido específico, explique somente esse sentido.",
    "Preencha detailed_explanation em todas as linhas; explique significado, contexto de uso, nuance, diferenças de termos parecidos e a construção gramatical relevante.",
    "Quando o card for um phrasal verb, explique a lógica da construção.",
    "Preencha usage_notes com observações práticas de uso e common_mistakes com erros frequentes de brasileiros quando forem relevantes.",
    "Preencha exatamente dois exemplos naturais em inglês e suas traduções nos quatro campos example_1_en, example_1_pt, example_2_en e example_2_pt.",
    "Use português simples, didático e direto nas explicações.",
    "Mantenha o CSV separado por vírgulas e todos os campos entre aspas duplas; aspas dentro do conteúdo devem ser duplicadas.",
    "Mantenha a codificação UTF-8 e exatamente a mesma quantidade de linhas de dados.",
    "Não acrescente, remova ou duplique cards e não invente, encurte ou substitua identificadores.",
    "Entregue somente o CSV preenchido, sem Markdown, bloco de código, introdução, conclusão ou JSON.",
    `Antes de finalizar, confira se existem exatamente ${batch.card_count} linhas de dados e se todas mantêm o export_id ${batch.export_id}.`,
  ];
  return [
    "Você recebeu um arquivo CSV de Cards Especiais exportado pelo App Piteco.",
    "Sua tarefa é preencher a explicação didática e devolver o mesmo CSV preenchido.",
    "O CSV pode trazer foco pedagógico explícito em focus_text, focus_tag e focus_note. Use esses campos para não adivinhar o que explicar.",
    "Só escolha/inferia a peça-chave quando focus_text estiver vazio.",
    "",
    `Lote esperado: ${batch.export_id}`,
    `Linhas de dados esperadas: ${batch.card_count}`,
    `Formato esperado: ${SPECIAL_CSV_FORMAT}`,
    `Versão esperada: ${SPECIAL_CSV_SCHEMA_VERSION}`,
    "",
    "Regras obrigatórias:",
    ...rules.map((rule, index) => `${index + 1}. ${rule}`),
  ].join("\n");
}

export function specialCsvFilename(batch: SpecialExportPackage): string {
  return `app-piteco-especiais-${batch.export_id}.csv`;
}

export function specialCsvPromptFilename(batch: SpecialExportPackage): string {
  return `app-piteco-prompt-especiais-${batch.export_id}.txt`;
}
