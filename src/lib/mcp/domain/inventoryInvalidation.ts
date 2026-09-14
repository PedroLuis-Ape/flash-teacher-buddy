import { invalidateVocabularyInventory } from "../learning/inventory";
import { asRow, str } from "./query";
import { scopeName, type LibraryScope } from "./scope";

/** Same physicalization the analyze_text_against_library tool uses as cacheKey. */
export function scopeForInstitution(institutionId: string | null | undefined): LibraryScope {
  return institutionId ? { kind: "institution", institutionId } : { kind: "personal" };
}

export function inventoryCacheKey(userId: string, institutionId: string | null | undefined): string {
  return userId + "|" + scopeName(scopeForInstitution(institutionId));
}

/**
 * Any write that changes the library must drop the hot vocabulary inventory of
 * that owner+scope, otherwise the next analysis compares against stale cards.
 */
export function invalidateScopeInventory(userId: string, institutionId: string | null | undefined): void {
  invalidateVocabularyInventory(inventoryCacheKey(userId, institutionId));
}

/** A list belongs to the folder's workspace; the folder embed is the authority. */
export function listInstitutionId(row: Record<string, unknown>): string | null {
  return str(asRow(row.folders), "institution_id") ?? str(row, "institution_id") ?? null;
}
