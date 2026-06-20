import { readCsvRows } from "@/features/global-import/csvReader";
import {
  parseSpecialImportText,
  type InvalidSpecialImportItem,
  type NormalizedSpecialImportItem,
  type ParsedSpecialImport,
  type SpecialImportExample,
} from "./parser";
import {
  SPECIAL_CARDS_FORMAT,
  SPECIAL_EXPLANATIONS_FORMAT,
  SPECIAL_SCHEMA_VERSION,
} from "./protocol";
import {
  SPECIAL_CSV_FORMAT,
  SPECIAL_CSV_HEADER_LINE,
  SPECIAL_CSV_HEADERS,
  SPECIAL_CSV_SCHEMA_VERSION,
  type SpecialCsvRecord,
} from "./csvContract";

function extractCsvCandidate(input: string): string {
  const trimmed = input.replace(/^\uFEFF/, "").trim();
  const fenced = trimmed.match(/```(?:csv)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const plainHeader = SPECIAL_CSV_HEADERS.join(",");
  const quotedIndex = trimmed.indexOf(SPECIAL_CSV_HEADER_LINE);
  const plainIndex = trimmed.indexOf(plainHeader);
  const indexes = [quotedIndex, plainIndex].filter((index) => index >= 0);
  if (indexes.length === 0) return trimmed;
  return trimmed.slice(Math.min(...indexes));
}

export function looksLikeSpecialCsv(input: string): boolean {
  const sample = input.replace(/^\uFEFF/, "").trim().slice(0, 8_000);
  if (!sample || sample.startsWith("{") || sample.startsWith("[")) return false;
  return sample.includes("flashcard_id")
    && sample.includes("detailed_explanation")
    && sample.includes("export_id");
}

function toRecord(values: string[]): SpecialCsvRecord {
  return Object.fromEntries(
    SPECIAL_CSV_HEADERS.map((header, index) => [header, values[index]?.trim() ?? ""]),
  ) as SpecialCsvRecord;
}

function examplesFromRecord(record: SpecialCsvRecord): SpecialImportExample[] | undefined {
  const examples = [
    { en: record.example_1_en || undefined, pt: record.example_1_pt || undefined },
    { en: record.example_2_en || undefined, pt: record.example_2_pt || undefined },
  ].filter((example) => example.en || example.pt);
  return examples.length ? examples : undefined;
}

function invalid(raw: unknown, sourceIndex: number, reason: string): InvalidSpecialImportItem {
  return { raw, source_index: sourceIndex, reason };
}

export function parseSpecialCsvText(input: string): ParsedSpecialImport {
  const rows = readCsvRows(extractCsvCandidate(input));
  if (rows.length < 2) throw new Error("O CSV precisa ter o cabeçalho e pelo menos uma linha de card.");

  const headers = rows[0].values.map((value, index) => (
    index === 0 ? value.replace(/^\uFEFF/, "").trim() : value.trim()
  ));
  const exactHeader = headers.length === SPECIAL_CSV_HEADERS.length
    && SPECIAL_CSV_HEADERS.every((header, index) => headers[index] === header);
  if (!exactHeader) {
    throw new Error(`Cabeçalho CSV inválido. Use exatamente: ${SPECIAL_CSV_HEADERS.join(", ")}`);
  }

  const items: NormalizedSpecialImportItem[] = [];
  const invalidItems: InvalidSpecialImportItem[] = [];
  let exportId: string | undefined;

  rows.slice(1).forEach((row, sourceIndex) => {
    if (row.values.length !== SPECIAL_CSV_HEADERS.length) {
      invalidItems.push(invalid(row.values, sourceIndex, `Linha ${row.line} possui ${row.values.length} campos; eram esperados ${SPECIAL_CSV_HEADERS.length}.`));
      return;
    }

    const record = toRecord(row.values);
    exportId ??= record.export_id || undefined;

    if (record.format !== SPECIAL_CSV_FORMAT) {
      invalidItems.push(invalid(record, sourceIndex, `Linha ${row.line}: format deve ser ${SPECIAL_CSV_FORMAT}.`));
      return;
    }
    if (record.schema_version !== String(SPECIAL_CSV_SCHEMA_VERSION)) {
      invalidItems.push(invalid(record, sourceIndex, `Linha ${row.line}: schema_version deve ser ${SPECIAL_CSV_SCHEMA_VERSION}.`));
      return;
    }
    if (!record.export_id || record.export_id !== exportId) {
      invalidItems.push(invalid(record, sourceIndex, `Linha ${row.line}: export_id ausente ou diferente do restante do lote.`));
      return;
    }
    if (!record.card_ref) {
      invalidItems.push(invalid(record, sourceIndex, `Linha ${row.line}: card_ref ausente.`));
      return;
    }
    if (!record.flashcard_id) {
      invalidItems.push(invalid(record, sourceIndex, `Linha ${row.line}: flashcard_id ausente.`));
      return;
    }
    if (!record.detailed_explanation) {
      invalidItems.push(invalid(record, sourceIndex, `Linha ${row.line}: detailed_explanation está vazia.`));
      return;
    }

    const examples = examplesFromRecord(record);
    const warnings: string[] = [];
    if (!examples || examples.length < 2) warnings.push("Menos de dois exemplos válidos foram recebidos.");

    items.push({
      flashcard_id: record.flashcard_id,
      card_ref: record.card_ref,
      term: record.term || undefined,
      translation: record.translation || undefined,
      detailed_explanation: record.detailed_explanation,
      usage_notes: record.usage_notes || undefined,
      common_mistakes: record.common_mistakes || undefined,
      example_text: record.example_1_en || undefined,
      example_translation: record.example_1_pt || undefined,
      examples,
      warnings,
      raw: record,
      source_index: sourceIndex,
    });
  });

  return {
    format: SPECIAL_EXPLANATIONS_FORMAT,
    schema_version: SPECIAL_SCHEMA_VERSION,
    export_id: exportId,
    source: "v2",
    items,
    invalid: invalidItems,
    warnings: [
      `CSV oficial de Especiais detectado (${items.length + invalidItems.length} linha(s)).`,
    ],
    repaired: false,
  };
}

export function parseSpecialImportInput(input: string): ParsedSpecialImport {
  if (looksLikeSpecialCsv(input)) return parseSpecialCsvText(input);
  return parseSpecialImportText(input);
}

export function isSpecialCardsExport(input: string): boolean {
  return input.includes(`"format": "${SPECIAL_CARDS_FORMAT}"`)
    || input.includes(`"format":"${SPECIAL_CARDS_FORMAT}"`);
}
