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
    "Preserve sem nenhuma alteração format, schema_version, export_id, card_ref, flashcard_id, term e translation.",
    "Preencha detailed_explanation em todas as linhas; explique significado, contexto de uso, diferenças de termos parecidos e a construção gramatical relevante.",
    "Quando o card for um phrasal verb, explique a lógica da construção; quando representar uma camada ou sentido específico, explique somente esse sentido.",
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
    "Sua tarefa é preencher explicações didáticas para todos os cards e devolver o mesmo CSV preenchido.",
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
