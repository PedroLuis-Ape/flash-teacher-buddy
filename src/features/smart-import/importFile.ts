import { SMART_IMPORT_LIMITS } from "./schema";

export const COMPLETE_IMPORT_FILE_ACCEPT = ".json,application/json";

export interface ReadableImportFile {
  name: string;
  size: number;
  text: () => Promise<string>;
}

export async function readCompleteImportFile(
  file?: ReadableImportFile,
): Promise<string | null> {
  if (!file) return null;

  if (!file.name.toLocaleLowerCase().endsWith(".json")) {
    throw new Error("Selecione um arquivo JSON do Super Importador.");
  }

  if (file.size > SMART_IMPORT_LIMITS.maxFileBytes) {
    throw new Error(
      `O arquivo excede ${Math.round(SMART_IMPORT_LIMITS.maxFileBytes / 1024 / 1024)} MB.`,
    );
  }

  const text = await file.text();
  if (!text.trim()) {
    throw new Error("O arquivo JSON está vazio.");
  }

  return text;
}
