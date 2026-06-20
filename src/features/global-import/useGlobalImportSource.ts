import { useState } from "react";
import { analyzeGlobalImportText } from "./analysisService";
import { parseGlobalImportCsv } from "./csvPackage";
import { APP_PITECO_SUPER_IMPORT_LIMITS } from "./schema/appPitecoSuperImportSchema";
import { validateGlobalImportInput, type GlobalImportV2ValidationResult } from "./validation";
import { looksLikeAdvancedSmartCsv, parseSmartImportSource } from "@/features/smart-import/sourceParser";

function looksLikeLegacyCsv(value: string): boolean {
  const normalized = value.trim().replace(/^```(?:csv)?\s*/i, "");
  const firstLine = normalized.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.includes("folder_name") && firstLine.includes("list_name") && !firstLine.includes("record_type");
}

function looksLikeJson(value: string): boolean {
  const normalized = value.trim().replace(/^```(?:json)?\s*/i, "");
  return normalized.startsWith("{") || normalized.startsWith("[");
}

export function useGlobalImportSource() {
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
      const nextValidation = validateGlobalImportInput(smart.packageValue, null);
      setRaw(value);
      setValidation(nextValidation);
      setNotes([...smart.notes, ...smart.warnings]);
      return nextValidation;
    }

    if (looksLikeLegacyCsv(value)) {
      const csv = parseGlobalImportCsv(value);
      const nextValidation = validateGlobalImportInput(csv.packageValue, null);
      setRaw(value);
      setValidation(nextValidation);
      setNotes([`CSV ${csv.schema} reconhecido com ${csv.rows} flashcard(s).`, ...csv.notes]);
      return nextValidation;
    }

    const result = analyzeGlobalImportText(value);
    const nextNotes: string[] = [];
    if (result.parsed.extracted) nextNotes.push("Uma única cerca Markdown externa foi removida.");
    if (result.validation.sourceFormat === "smart") nextNotes.push("Contrato app-piteco-super-import 2.0 validado.");
    if (result.validation.sourceFormat === "official") nextNotes.push("Contrato oficial app-piteco-super-import 1.0 validado.");
    if (result.validation.sourceFormat === "canonical") nextNotes.push("Formato ape-global-import aceito por compatibilidade.");
    if (result.validation.sourceFormat === "legacy") nextNotes.push("Formato legado aceito por compatibilidade.");
    setRaw(value);
    setValidation(result.validation);
    setNotes(nextNotes);
    return result.validation;
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
