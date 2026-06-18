import { useState } from "react";
import { analyzeGlobalImportText } from "./analysisService";
import { GLOBAL_IMPORT_LIMITS } from "./schema/globalImportSchema";
import type { GlobalImportV2ValidationResult } from "./validation";

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
    const result = analyzeGlobalImportText(value);
    const nextNotes: string[] = [];
    if (result.parsed.extracted) nextNotes.push("O JSON foi extraído do texto ao redor.");
    if (result.parsed.repaired) nextNotes.push("Vírgulas finais inválidas foram removidas com segurança.");
    if (result.validation.sourceFormat === "canonical") nextNotes.push("Protocolo canônico ape-global-import validado contra o manifesto local.");
    if (result.validation.sourceFormat === "legacy") nextNotes.push("Formato legado aceito por compatibilidade.");
    setRaw(value);
    setValidation(result.validation);
    setNotes(nextNotes);
    return result.validation;
  };

  const readFile = async (file?: File) => {
    if (!file) return null;
    if (file.size > GLOBAL_IMPORT_LIMITS.maxFileBytes) {
      throw new Error("O arquivo excede 5 MB.");
    }
    const text = await file.text();
    reset(text);
    return { text, validation: analyze(text) };
  };

  return { raw, validation, notes, reset, analyze, readFile };
}
