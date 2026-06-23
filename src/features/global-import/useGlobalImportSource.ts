import { useState } from "react";
import { analyzeGlobalImportText } from "./analysisService";
import { parseGlobalImportCsv } from "./csvPackage";
import { buildLayerChecks } from "./layerChecks";
import { APP_PITECO_SUPER_IMPORT_LIMITS } from "./schema/appPitecoSuperImportSchema";
import { repairSmartImportJsonText } from "./smartJsonRepair";
import { validateGlobalImportInput, type GlobalImportV2ValidationResult } from "./validation";
import { looksLikeAdvancedSmartCsv, parseSmartImportSource } from "@/features/smart-import/sourceParser";

interface UseGlobalImportSourceOptions {
  repairSmartJson?: boolean;
  reviewLayers?: boolean;
}

function looksLikeLegacyCsv(value: string): boolean {
  const normalized = value.trim().replace(/^```(?:csv)?\s*/i, "");
  const firstLine = normalized.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.includes("folder_name") && firstLine.includes("list_name") && !firstLine.includes("record_type");
}

function looksLikeJson(value: string): boolean {
  const normalized = value.trim().replace(/^```(?:json)?\s*/i, "");
  return normalized.startsWith("{") || normalized.startsWith("[");
}

function withLayerChecks(
  validation: GlobalImportV2ValidationResult,
  enabled: boolean,
): GlobalImportV2ValidationResult {
  if (!enabled || !validation.smartPackage) return validation;
  const issues = [...validation.issues, ...buildLayerChecks(validation.smartPackage)];
  return {
    ...validation,
    issues,
    valid: !issues.some((issue) => issue.severity === "error"),
  };
}

export function useGlobalImportSource(options: UseGlobalImportSourceOptions = {}) {
  const [raw, setRaw] = useState("");
  const [validation, setValidation] = useState<GlobalImportV2ValidationResult | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const layerReviewEnabled = Boolean(options.reviewLayers ?? options.repairSmartJson);

  const reset = (value: string) => {
    setRaw(value);
    setValidation(null);
    setNotes([]);
  };

  const analyze = (value = raw) => {
    if (looksLikeAdvancedSmartCsv(value) || (!looksLikeJson(value) && !looksLikeLegacyCsv(value))) {
      const smart = parseSmartImportSource(value, {
        packageName: "Pacote importado",
        folderName: "Pasta importada",
        listName: "Principal",
        frontLanguage: "en",
        backLanguage: "pt-BR",
      });
      const nextValidation = withLayerChecks(
        validateGlobalImportInput(smart.packageValue, null),
        layerReviewEnabled,
      );
      setRaw(value);
      setValidation(nextValidation);
      setNotes([...smart.notes, ...smart.warnings]);
      return nextValidation;
    }

    if (looksLikeLegacyCsv(value)) {
      const csv = parseGlobalImportCsv(value);
      const nextValidation = withLayerChecks(
        validateGlobalImportInput(csv.packageValue, null),
        layerReviewEnabled,
      );
      setRaw(value);
      setValidation(nextValidation);
      setNotes([`CSV ${csv.schema} reconhecido com ${csv.rows} flashcard(s).`, ...csv.notes]);
      return nextValidation;
    }

    const repair = options.repairSmartJson
      ? repairSmartImportJsonText(value)
      : { text: value, changed: false, notes: [] as string[] };
    const result = analyzeGlobalImportText(repair.text);
    const checkedValidation = withLayerChecks(result.validation, layerReviewEnabled);
    const nextNotes: string[] = [...repair.notes];
    if (result.parsed.extracted) nextNotes.push("Uma única cerca Markdown externa foi removida.");
    if (checkedValidation.sourceFormat === "smart") nextNotes.push("Contrato app-piteco-super-import 2.0 validado.");
    if (checkedValidation.sourceFormat === "official") nextNotes.push("Contrato oficial app-piteco-super-import 1.0 validado.");
    if (checkedValidation.sourceFormat === "canonical") nextNotes.push("Formato ape-global-import aceito por compatibilidade.");
    if (checkedValidation.sourceFormat === "legacy") nextNotes.push("Formato legado aceito por compatibilidade.");
    setRaw(repair.changed ? repair.text : value);
    setValidation(checkedValidation);
    setNotes(nextNotes);
    return checkedValidation;
  };

  const readFile = async (file?: File) => {
    if (!file) return null;
    if (file.size > APP_PITECO_SUPER_IMPORT_LIMITS.maxFileBytes) throw new Error("O arquivo excede 10 MB.");
    const text = await file.text();
    reset(text);
    return { text, validation: analyze(text) };
  };

  return { raw, validation, notes, reset, analyze, readFile };
}
