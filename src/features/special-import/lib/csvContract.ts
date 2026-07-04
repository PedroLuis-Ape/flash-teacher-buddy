export const SPECIAL_CSV_FORMAT = "ape-special-explanations-csv" as const;
export const SPECIAL_CSV_SCHEMA_VERSION = 2 as const;
export const SPECIAL_CSV_SCHEMA_VERSION_V1 = 1 as const;

export const SPECIAL_CSV_HEADERS_V1 = [
  "format",
  "schema_version",
  "export_id",
  "card_ref",
  "flashcard_id",
  "term",
  "translation",
  "detailed_explanation",
  "usage_notes",
  "common_mistakes",
  "example_1_en",
  "example_1_pt",
  "example_2_en",
  "example_2_pt",
] as const;

export const SPECIAL_CSV_HEADERS = [
  "format",
  "schema_version",
  "export_id",
  "card_ref",
  "flashcard_id",
  "term",
  "translation",
  "focus_text",
  "focus_side",
  "focus_tag",
  "focus_note",
  "detailed_explanation",
  "usage_notes",
  "common_mistakes",
  "example_1_en",
  "example_1_pt",
  "example_2_en",
  "example_2_pt",
] as const;

export type SpecialCsvHeader = (typeof SPECIAL_CSV_HEADERS)[number];
export type SpecialCsvRecord = Record<SpecialCsvHeader, string>;

export function escapeSpecialCsvField(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export const SPECIAL_CSV_HEADER_LINE = SPECIAL_CSV_HEADERS
  .map(escapeSpecialCsvField)
  .join(",");

export const SPECIAL_CSV_HEADER_LINE_V1 = SPECIAL_CSV_HEADERS_V1
  .map(escapeSpecialCsvField)
  .join(",");

export function serializeSpecialCsvRecord(record: SpecialCsvRecord): string {
  return SPECIAL_CSV_HEADERS
    .map((header) => escapeSpecialCsvField(record[header]))
    .join(",");
}
