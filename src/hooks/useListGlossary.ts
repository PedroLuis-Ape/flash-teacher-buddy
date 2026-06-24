import { useFolderGlossary } from "./useFolderGlossary";

export const ACCOUNT_GLOSSARY_QUERY_KEY = ["folder-glossary"] as const;

export function useListGlossary(listId?: string) {
  return useFolderGlossary(undefined, listId);
}

export type {
  GlossaryEntry,
  GlossaryInsert,
  GlossaryImportResult,
} from "./useFolderGlossary";
