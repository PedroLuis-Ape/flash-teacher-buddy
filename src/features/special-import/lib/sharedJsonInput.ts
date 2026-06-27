import {
  extractAndRepairJson,
  hasTruncatedJson,
} from "@/features/global-import/resilientParser";
import { parseSpecialImportText, type ParsedSpecialImport } from "./parser";

export function parseSpecialJsonInput(input: string): ParsedSpecialImport {
  const parsed = extractAndRepairJson(input);
  if (!parsed) {
    if (hasTruncatedJson(input)) {
      throw new Error("A resposta parece ter sido cortada antes do fim. Peça à IA apenas os cards faltantes ou gere novamente o lote.");
    }
    throw new Error("Não foi possível localizar um objeto ou array JSON válido na resposta.");
  }

  const result = parseSpecialImportText(JSON.stringify(parsed.value));
  return {
    ...result,
    repaired: result.repaired || parsed.repaired,
    warnings: Array.from(new Set([
      ...result.warnings,
      ...(parsed.extracted ? ["O JSON foi extraído do conteúdo recebido."] : []),
      ...(parsed.repaired ? ["Vírgulas finais inválidas foram removidas automaticamente."] : []),
    ])),
  };
}
