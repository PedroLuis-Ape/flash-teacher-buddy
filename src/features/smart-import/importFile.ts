import { SMART_IMPORT_LIMITS } from "./schema";
import { readImportFile, type ReadableImportFile } from "@/features/import-shared/readImportFile";
export type { ReadableImportFile } from "@/features/import-shared/readImportFile";

export const COMPLETE_IMPORT_FILE_ACCEPT = ".json,application/json";

export async function readCompleteImportFile(
  file?: ReadableImportFile,
): Promise<string | null> {
  if (!file) return null;

  if (!file.name.toLocaleLowerCase().endsWith(".json")) {
    throw new Error("Selecione um arquivo JSON do Super Importador.");
  }

  return readImportFile(file, SMART_IMPORT_LIMITS.maxFileBytes);
}
