import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const listDetail = read("src/pages/ListDetail.tsx");
const preview = read("src/features/cards/components/LayeredCardPreviewDialog.tsx");
const editDialog = read("src/components/EditFlashcardDialog.tsx");
const layerEditor = read("src/features/cards/components/LayeredCardEditor.tsx");
const layeredCards = read("src/features/cards/lib/layeredCards.ts");
const migration = read("supabase/migrations/20260712223000_atomic_layered_card_groups.sql");

describe("layered card viewing and editing contract", () => {
  it("opens a read-only layer preview from the layered card row", () => {
    expect(listDetail).toContain("LayeredCardPreviewDialog");
    expect(listDetail).toContain("onViewLayers(flashcard)");
    expect(listDetail).toContain('event.key === "Enter" || event.key === " "');
    expect(listDetail).toContain("layers={viewingLayers}");
    expect(listDetail).toContain("card.parent_card_id === viewingLayeredCard.id");

    expect(preview).toContain("Esta janela é somente para visualização");
    expect(preview).toContain("Camada {index + 1}");
    expect(preview).toContain("layer.example_text");
    expect(preview).not.toContain("saveLayeredCardGroup");
  });

  it("keeps row action buttons independent from the preview click", () => {
    expect(listDetail).toContain("event.stopPropagation()");
    expect(listDetail).toContain("onEdit(flashcard)");
    expect(listDetail).toContain("onUnmerge(flashcard.id)");
    expect(listDetail).toContain("onDelete(flashcard.id)");
  });

  it("keeps individual layer editing connected to the atomic save operation", () => {
    expect(editDialog).toContain("<LayeredCardEditor");
    expect(editDialog).toContain("principalId={flashcard.id}");
    expect(layerEditor).toContain("parent_card_id");
    expect(layerEditor).toContain("updateLayer(index");
    expect(layerEditor).toContain("moveLayer(index");
    expect(layerEditor).toContain("removeLayer(index)");
    expect(layerEditor).toContain("saveLayeredCardGroup({");
    expect(layeredCards).toContain('rpc("save_layered_card_group_v2"');
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.save_layered_card_group_v2");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.save_layered_card_group_v2");
  });
});
