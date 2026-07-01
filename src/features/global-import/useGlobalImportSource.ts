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

function layeredPreservationNote(validation: GlobalImportV2ValidationResult): string | null {
  if (!validation.smartPackage) return null;
  const groups = validation.smartPackage.package.folders.reduce(
    (folderTotal, folder) => folderTotal + folder.lists.reduce(
      (listTotal, list) => listTotal + list.cards.filter((card) => card.type === "layered").length,
      0,
    ),
    0,
  );
  if (groups === 0) return null;
  return `${groups} grupo(s) em camadas reconhecido(s) e preservado(s) para criação automática.`;
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
      const preservationNote = layeredPreservationNote(checkedValidation);
      setRaw(value);
      setValidation(checkedValidation);
      setNotes([
        ...smart.notes,
        ...smart.warnings,
        ...(preservationNote ? [preservationNote] : []),
      ]);
      return checkedValidation;
    }

    if (looksLikeLegacyCsv(value)) {
      const csv = parseGlobalImportCsv(value);
      const checkedValidation = validateGlobalImportInput(csv.packageValue, null);
      const preservationNote = layeredPreservationNote(checkedValidation);
      setRaw(value);
      setValidation(checkedValidation);
      setNotes([
        `CSV ${csv.schema} reconhecido com ${csv.rows} flashcard(s).`,
        ...csv.notes,
        ...(preservationNote ? [preservationNote] : []),
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
    const preservationNote = layeredPreservationNote(checkedValidation);
    if (preservationNote) nextNotes.push(preservationNote);
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
