import { hasTruncatedJson } from "@/features/global-import/resilientParser";
import { parseSmartJsonWithShield } from "./jsonShield";
import {
  parseSmartImportSource,
  type SmartImportContext,
  type SmartImportSourceResult,
} from "./sourceParser";

export function parseAnySmartImportSource(
  input: string,
  context: SmartImportContext = {},
): SmartImportSourceResult {
  if (!input.trim()) throw new Error("O conteúdo está vazio.");

  const json = parseSmartJsonWithShield(input);
  if (json) return json;

  if (hasTruncatedJson(input) && /^\s*(?:```(?:json)?\s*)?[\[{]/i.test(input)) {
    throw new Error("O JSON parece ter sido cortado antes do fim.");
  }

  return parseSmartImportSource(input, context);
}
