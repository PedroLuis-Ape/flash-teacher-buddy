import { useState } from "react";
import { analyzeGlobalImportText } from "./analysisService";
import { parseGlobalImportCsv } from "./csvPackage";
import { flattenSuperImportLayers } from "./flattenSuperImportLayers";
import { decodeImportFile } from "./importSourceDecoder";
import { APP_PITECO_SUPER_IMPORT_LIMITS } from "./schema/appPitecoSuperImportSchema";
import { repairSmartImportJsonText } from "./smartJsonRepair";
import { validateGlobalImportInput, type GlobalImportV2ValidationResult } from "./validation";
import { looksLikeAdvancedSmartCsv, parseSmartImportSource } from "@/features/smart-import/sourceParser";
import { SMART_IMPORT_LIMITS, type SmartImportPackage } from "@/features/smart-import/schema";

interface UseGlobalImportSourceOptions {
  repairSmartJson?: boolean;
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

function withoutAutomaticLayers(
  validation: GlobalImportV2ValidationResult,
): {
  validation: GlobalImportV2ValidationResult;
  note?: string;
  normalizedPackage?: SmartImportPackage;
} {
  if (!validation.smartPackage) return { validation };

  const flattened = flattenSuperImportLayers(validation.smartPackage);
  if (flattened.groupsFlattened === 0) return { validation };

  return {
    validation: validateGlobalImportInput(flattened.packageValue, null),
    normalizedPackage: flattened.packageValue,
    note: `${flattened.groupsFlattened} grupo(s) em camadas foram convertidos em ${flattened.cardsCreated} cards normais. Você pode mesclá-los manualmente depois na tela da lista.`,
  };
}

export function useGlobalImportSource(options: UseGlobalImportSourceOptions = {}) {
  const [raw, setRaw] = useState("");
  const [validation, setValidation] = useState<GlobalImportV2ValidationResult | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

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
      const normalized = withoutAutomaticLayers(validateGlobalImportInput(smart.packageValue, null));
      setRaw(value);
      setValidation(normalized.validation);
      setNotes([
        ...smart.notes,
        ...smart.warnings,
        ...(normalized.note ? [normalized.note] : []),
      ]);
      return normalized.validation;
    }

    if (looksLikeLegacyCsv(value)) {
      const csv = parseGlobalImportCsv(value);
      const normalized = withoutAutomaticLayers(validateGlobalImportInput(csv.packageValue, null));
      setRaw(value);
      setValidation(normalized.validation);
      setNotes([
        `CSV ${csv.schema} reconhecido com ${csv.rows} flashcard(s).`,
        ...csv.notes,
        ...(normalized.note ? [normalized.note] : []),
      ]);
      return normalized.validation;
    }

    const repair = options.repairSmartJson
      ? repairSmartImportJsonText(value)
      : { text: value, changed: false, notes: [] as string[] };
    const result = analyzeGlobalImportText(repair.text);
    const normalized = withoutAutomaticLayers(result.validation);
    const checkedValidation = normalized.validation;
    const nextNotes: string[] = [...repair.notes, ...result.compatibilityWarnings];
    if (result.parsed.extracted) nextNotes.push("O JSON foi extraído do conteúdo recebido.");
    if (result.parsed.repaired) nextNotes.push("Vírgulas finais inválidas foram reparadas fora de strings.");
    if (checkedValidation.sourceFormat === "smart") nextNotes.push("Contrato app-piteco-super-import 2.0 validado.");
    if (checkedValidation.sourceFormat === "official") nextNotes.push("Contrato oficial app-piteco-super-import 1.0 validado.");
    if (checkedValidation.sourceFormat === "canonical") nextNotes.push("Formato ape-global-import aceito por compatibilidade.");
    if (checkedValidation.sourceFormat === "legacy") nextNotes.push("Formato legado aceito por compatibilidade.");
    if (normalized.note) nextNotes.push(normalized.note);
    setRaw(normalized.normalizedPackage
      ? JSON.stringify(normalized.normalizedPackage, null, 2)
      : repair.changed
        ? repair.text
        : value);
    setValidation(checkedValidation);
    setNotes(Array.from(new Set(nextNotes)));
    return checkedValidation;
  };

  const readFile = async (file?: File) => {
    if (!file) return null;
    const maxFileBytes = Math.max(
      APP_PITECO_SUPER_IMPORT_LIMITS.maxFileBytes,
      SMART_IMPORT_LIMITS.maxFileBytes,
    );
    if (file.size > maxFileBytes) {
      throw new Error(`O arquivo excede ${Math.round(maxFileBytes / 1024 / 1024)} MB.`);
    }
    const decoded = await decodeImportFile(file);
    reset(decoded.text);
    const checked = analyze(decoded.text);
    if (decoded.warnings.length > 0) {
      setNotes((current) => Array.from(new Set([...decoded.warnings, ...current])));
    }
    return { text: decoded.text, validation: checked };
  };

  return { raw, validation, notes, reset, analyze, readFile };
}
