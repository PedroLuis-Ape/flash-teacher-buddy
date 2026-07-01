import { useState } from "react";
import { analyzeGlobalImportText } from "./analysisService";
import { parseGlobalImportCsv } from "./csvPackage";
import { APP_PITECO_SUPER_IMPORT_LIMITS } from "./schema/appPitecoSuperImportSchema";
import { repairSmartImportJsonText } from "./smartJsonRepair";
import { validateGlobalImportInput, type GlobalImportV2ValidationResult } from "./validation";
import { looksLikeAdvancedSmartCsv, parseSmartImportSource } from "@/features/smart-import/sourceParser";
import { SMART_IMPORT_LIMITS } from "@/features/smart-import/schema";

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
      const checkedValidation = validateGlobalImportInput(smart.packageValue, null);
      setRaw(value);
      setValidation(checkedValidation);
      setNotes([
        ...smart.notes,
        ...smart.warnings,
        ...(checkedValidation.smartPackage && checkedValidation.smartPackage.declared_totals?.layered_groups
          ? ["Grupos em camadas reconhecidos e preservados para importação automática."]
          : []),
      ]);
      return checkedValidation;
    }

    if (looksLikeLegacyCsv(value)) {
      const csv = parseGlobalImportCsv(value);
      const checkedValidation = validateGlobalImportInput(csv.packageValue, null);
      setRaw(value);
      setValidation(checkedValidation);
      setNotes([
        `CSV ${csv.schema} reconhecido com ${csv.rows} flashcard(s).`,
        ...csv.notes,
      ]);
      return checkedValidation;
    }

    const repair = options.repairSmartJson !== false
      ? repairSmartImportJsonText(value)
      : { text: value, changed: false, notes: [] as string[] };
    const result = analyzeGlobalImportText(repair.text);
    const checkedValidation = result.validation;
    const nextNotes: string[] = [...repair.notes];
    if (result.parsed.extracted) nextNotes.push("Uma única cerca Markdown externa foi removida.");
    if (checkedValidation.sourceFormat === "smart") nextNotes.push("Contrato app-piteco-super-import 2.0 validado.");
    if (checkedValidation.sourceFormat === "official") nextNotes.push("Contrato oficial app-piteco-super-import 1.0 validado.");
    if (checkedValidation.sourceFormat === "canonical") nextNotes.push("Formato ape-global-import aceito por compatibilidade.");
    if (checkedValidation.sourceFormat === "legacy") nextNotes.push("Formato legado aceito por compatibilidade.");
    if (checkedValidation.smartPackage?.declared_totals?.layered_groups) {
      nextNotes.push("Grupos em camadas reconhecidos e preservados para importação automática.");
    }
    setRaw(repair.changed ? repair.text : value);
    setValidation(checkedValidation);
    setNotes(nextNotes);
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
    const text = await file.text();
    reset(text);
    return { text, validation: analyze(text) };
  };

  return { raw, validation, notes, reset, analyze, readFile };
}
