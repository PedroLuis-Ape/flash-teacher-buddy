import { normalizeGlobalImportValue } from "@/features/global-import/normalizer";
import { normalizeSmartImportCompatibility } from "@/features/global-import/importCompatibility";
import { extractAndRepairJson } from "@/features/global-import/resilientParser";
import { legacyPackageToSmartImport } from "./adapters";
import { smartImportPackageSchema } from "./schema";
import type { SmartImportSourceResult } from "./sourceParser";

function errorMessage(error: { issues: Array<{ path: Array<string | number>; message: string }> }): string {
  const first = error.issues[0];
  return `${first?.path.join(".") || "$"}: ${first?.message || "Contrato inválido."}`;
}

export function parseSmartJsonWithShield(input: string): SmartImportSourceResult | null {
  const parsed = extractAndRepairJson(input);
  if (!parsed) return null;

  const exact = smartImportPackageSchema.safeParse(parsed.value);
  if (exact.success) {
    return {
      packageValue: exact.data,
      format: "json-v2",
      notes: [
        "Contrato app-piteco-super-import 2.0 reconhecido.",
        ...(parsed.extracted ? ["O JSON foi extraído do conteúdo recebido."] : []),
        ...(parsed.repaired ? ["Vírgulas finais inválidas foram reparadas."] : []),
      ],
      warnings: [],
    };
  }

  const compatible = normalizeSmartImportCompatibility(parsed.value);
  const normalizedV2 = smartImportPackageSchema.safeParse(compatible.value);
  if (normalizedV2.success) {
    return {
      packageValue: normalizedV2.data,
      format: "json-v2",
      notes: ["Contrato 2.0 normalizado pela camada de compatibilidade."],
      warnings: compatible.warnings,
    };
  }

  const legacy = normalizeGlobalImportValue(parsed.value);
  if (legacy.success) {
    return {
      packageValue: legacyPackageToSmartImport(legacy.data.packageValue),
      format: "json-v2",
      notes: [`Formato ${legacy.data.sourceFormat} normalizado para o motor 2.0.`],
      warnings: legacy.data.warnings,
    };
  }

  const record = parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value)
    ? parsed.value as Record<string, unknown>
    : null;
  if (record && (record.schema || record.format || record.package || record.pacote)) {
    throw new Error(errorMessage(normalizedV2.error));
  }
  return null;
}
