import { APP_PITECO_SUPER_IMPORT_LIMITS } from "./schema/appPitecoSuperImportSchema";
import { extractAndRepairJson, hasTruncatedJson } from "./resilientParser";

export interface ParsedGlobalImportText {
  value: unknown;
  extracted: boolean;
  repaired: boolean;
  sourceText: string;
}

export function parseGlobalImportText(input: string): ParsedGlobalImportText {
  const byteSize = new TextEncoder().encode(input).byteLength;
  if (byteSize > APP_PITECO_SUPER_IMPORT_LIMITS.maxFileBytes) {
    throw new Error(`O pacote excede o limite de ${Math.floor(APP_PITECO_SUPER_IMPORT_LIMITS.maxFileBytes / 1024 / 1024)} MB.`);
  }
  if (!input.trim()) throw new Error("O conteúdo está vazio.");

  const parsed = extractAndRepairJson(input);
  if (parsed) return parsed;

  if (hasTruncatedJson(input)) {
    throw new Error("O JSON parece ter sido cortado antes do fim.");
  }
  throw new Error("A resposta não contém um JSON válido.");
}
