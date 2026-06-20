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
    "Preserve o cabeçalho e a ordem das linhas.",
    "Preserve format, schema_version, export_id, card_ref, flashcard_id, term e translation.",
    "Preencha detailed_explanation, usage_notes, common_mistakes e dois exemplos bilíngues.",
    "Use português didático para brasileiros nas explicações.",
    "Mantenha o CSV separado por vírgulas, com todos os campos entre aspas duplas.",
    "Mantenha exatamente a mesma quantidade de linhas; não invente IDs.",
    "A saída deve conter apenas o CSV preenchido, sem texto adicional.",
  ];
  return [
    "Preencha o arquivo CSV de Cards Especiais do App Piteco.",
    `Lote: ${batch.export_id}`,
    `Linhas de dados esperadas: ${batch.card_count}`,
    `Formato: ${SPECIAL_CSV_FORMAT}`,
    `Versão: ${SPECIAL_CSV_SCHEMA_VERSION}`,
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
