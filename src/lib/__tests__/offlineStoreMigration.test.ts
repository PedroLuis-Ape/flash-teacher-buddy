/**
 * Phase 6 — offline snapshot v1 → v2 migration (pure, no IDB).
 */
import { describe, it, expect } from "vitest";
import { migrateRecord, OFFLINE_SCHEMA_VERSION, type OfflineListData } from "../offlineStore";

function v1Snapshot(): OfflineListData {
  // Intentionally omits schemaVersion, userId, and the new flashcard fields.
  return {
    listId: "list-1",
    listMeta: {
      title: "L",
      lang_a: "en",
      lang_b: "pt",
      labels_a: "a",
      labels_b: "b",
      study_type: "vocab",
      tts_enabled: true,
    },
    flashcards: [
      { id: "c1", term: "cat", translation: "gato" },
      { id: "c2", term: "dog", translation: "cachorro" },
    ],
    favorites: [],
    downloadedAt: "2026-01-01T00:00:00Z",
    version: 1,
  };
}

describe("migrateRecord", () => {
  it("returns null for null input", () => {
    expect(migrateRecord(null)).toBeNull();
  });

  it("stamps schemaVersion and back-fills status_group_uid = id for non-layered cards", () => {
    const out = migrateRecord(v1Snapshot())!;
    expect(out.schemaVersion).toBe(OFFLINE_SCHEMA_VERSION);
    expect(out.userId).toBeNull();
    expect(out.flashcards[0].status_group_uid).toBe("c1");
    expect(out.flashcards[1].status_group_uid).toBe("c2");
  });

  it("does NOT invent a group identity for a layered card that has only parent_card_id", () => {
    const rec = v1Snapshot();
    rec.flashcards.push({ id: "layer1", term: "x", translation: "y", parent_card_id: "P" });
    const out = migrateRecord(rec)!;
    const layer = out.flashcards.find((f) => f.id === "layer1")!;
    expect(layer.status_group_uid).toBeNull(); // requires resync
    expect(layer.parent_card_id).toBe("P");
  });

  it("is idempotent (re-migrating a v2 record is a no-op)", () => {
    const out1 = migrateRecord(v1Snapshot())!;
    const out2 = migrateRecord(out1)!;
    expect(out2).toBe(out1); // same reference: already v2
  });
});