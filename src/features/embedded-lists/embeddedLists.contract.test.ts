import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260914200000_embedded_lists.sql", import.meta.url),
  "utf8",
);
const gateway = readFileSync(new URL("../study/lib/studyDeckSupabaseGateway.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("./embeddedListsService.ts", import.meta.url), "utf8");
const createDialog = readFileSync(new URL("./CreateEmbeddedListDialog.tsx", import.meta.url), "utf8");
const managerDialog = readFileSync(new URL("./EmbeddedListManagerDialog.tsx", import.meta.url), "utf8");

describe("embedded lists contract", () => {
  it("stores membership as a unique reference to canonical flashcards", () => {
    expect(migration).toContain("PRIMARY KEY (embedded_list_id, flashcard_id)");
    expect(migration).toContain("flashcard_id uuid NOT NULL REFERENCES public.flashcards(id)");
    expect(migration).toContain("ON CONFLICT (embedded_list_id, flashcard_id) DO NOTHING");
    expect(migration).toContain("card.parent_card_id IS NULL");
  });

  it("keeps embed mutations owner-scoped and inside the same folder", () => {
    expect(migration).toContain("list_row.owner_id = auth.uid()");
    expect(migration).toContain("source_list.folder_id = v_folder_id");
    expect(migration).toContain("source_list.owner_id = auth.uid()");
    expect(migration).toContain("Every source must be an owned normal list in the same folder");
  });

  it("unembed operations delete membership only and never canonical flashcards", () => {
    const start = migration.indexOf("CREATE OR REPLACE FUNCTION public.unembed_cards");
    const end = migration.indexOf("CREATE OR REPLACE FUNCTION public.unembed_source_list", start);
    const unembedFunction = migration.slice(start, end);
    expect(unembedFunction).toContain("DELETE FROM public.embedded_list_cards");
    expect(unembedFunction).not.toContain("DELETE FROM public.flashcards");

    const clearStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.clear_embedded_list");
    const clearEnd = migration.indexOf("CREATE OR REPLACE FUNCTION public.create_embedded_list", clearStart);
    expect(migration.slice(clearStart, clearEnd)).not.toContain("DELETE FROM public.flashcards");
  });

  it("loads embedded study rows through the shared gateway without replacing normal or portal paths", () => {
    expect(gateway).toContain('"get_embedded_flashcards"');
    expect(gateway).toContain('"get_embedded_list_availability"');
    expect(gateway).toContain('context.source === "portal-list-rpc"');
    expect(gateway).toContain('.eq("list_id", context.resourceId)');
    expect(gateway).toContain("isMissingEmbeddedSchemaError");
  });

  it("exposes the full reversible client pipeline", () => {
    expect(service).toContain("createEmbeddedList");
    expect(service).toContain("embedSourceLists");
    expect(service).toContain("embedCards");
    expect(service).toContain("unembedCards");
    expect(service).toContain("unembedSourceList");
    expect(service).toContain("clearEmbeddedList");
  });

  it("uses explicit combined-list language and never calls unembed delete", () => {
    expect(createDialog).toContain("Lista combinada");
    expect(managerDialog).toContain("Remover da lista combinada");
    expect(managerDialog).toContain("Esvaziar lista combinada");
    expect(managerDialog).toContain("Nenhum flashcard original será apagado ou movido");
  });
});
