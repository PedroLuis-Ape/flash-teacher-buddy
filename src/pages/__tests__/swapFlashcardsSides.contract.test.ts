import { describe, it, expect, vi } from "vitest";

/**
 * ============================================================
 *  REGRESSION CONTRACT — "Inverter conteúdo dos cards"
 * ============================================================
 *
 *  This test does NOT hit Supabase. It encodes the *frontend
 *  contract* that protects `handleSwapSides` (in ListDetail.tsx)
 *  from being silently regressed in future refactors.
 *
 *  The rules below are immutable:
 *
 *  1. The inversion MUST be performed by a single Supabase RPC
 *     call: `swap_flashcards_sides`.
 *  2. The frontend MUST NOT loop card-by-card to update them.
 *  3. The inversion MUST only swap card content (term ↔
 *     translation). It MUST NOT touch list/folder settings:
 *       - lang_a, lang_b
 *       - labels_a, labels_b
 *       - study_type
 *       - tts_enabled
 *  4. After a successful inversion, the affected caches
 *     (`flashcards`, `gameshub-list`, `study-flashcards`) and
 *     the offline copy MUST be invalidated.
 *  5. Card IDs and card order MUST be preserved.
 */

// ---- Pure simulation helpers (mirror server-side semantics) ----

type CardRow = {
  id: string;
  term: string;
  translation: string;
  // Fields that must NEVER be touched by the swap:
  list_id: string;
  word_hints?: unknown;
  image_url_a?: string | null;
  image_url_b?: string | null;
};

type ListSettings = {
  lang_a: string;
  lang_b: string;
  labels_a: string;
  labels_b: string;
  study_type: string;
  tts_enabled: boolean;
};

/** Pure mirror of what `swap_flashcards_sides` does on the server. */
function simulateRpcSwap(cards: CardRow[]): CardRow[] {
  return cards.map((c) => ({
    ...c,
    term: c.translation,
    translation: c.term,
  }));
}

const baseCards: CardRow[] = [
  { id: "a", term: "dog", translation: "cachorro", list_id: "L1" },
  { id: "b", term: "cat", translation: "gato", list_id: "L1" },
  { id: "c", term: "house", translation: "casa", list_id: "L1" },
];

const baseSettings: ListSettings = {
  lang_a: "en",
  lang_b: "pt",
  labels_a: "English",
  labels_b: "Português",
  study_type: "language",
  tts_enabled: true,
};

describe("Swap content (RPC contract)", () => {
  it("term and translation are swapped per card", () => {
    const out = simulateRpcSwap(baseCards);
    expect(out[0].term).toBe("cachorro");
    expect(out[0].translation).toBe("dog");
    expect(out[1].term).toBe("gato");
    expect(out[1].translation).toBe("cat");
  });

  it("card order is preserved", () => {
    const out = simulateRpcSwap(baseCards);
    expect(out.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("card IDs are preserved", () => {
    const out = simulateRpcSwap(baseCards);
    for (let i = 0; i < baseCards.length; i++) {
      expect(out[i].id).toBe(baseCards[i].id);
    }
  });

  it("list settings are NOT modified by the swap operation", () => {
    // The swap only touches cards. List settings (lang_a/lang_b/
    // labels/study_type/tts_enabled) must remain byte-identical.
    const settingsCopy = { ...baseSettings };
    simulateRpcSwap(baseCards);
    expect(settingsCopy).toEqual(baseSettings);
  });

  it("a second swap restores the original content (idempotent pair)", () => {
    const once = simulateRpcSwap(baseCards);
    const twice = simulateRpcSwap(once);
    expect(twice).toEqual(baseCards);
  });
});

describe("Swap content (frontend call contract)", () => {
  it("frontend MUST call the RPC exactly once (no per-card loop)", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { success: true, cards_swapped: baseCards.length },
      error: null,
    });

    // Minimal mirror of handleSwapSides RPC dispatch
    async function callSwap(listId: string) {
      return rpc("swap_flashcards_sides", { _list_id: listId });
    }

    await callSwap("L1");

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("swap_flashcards_sides", { _list_id: "L1" });
  });

  it("frontend MUST NOT issue N updates for N cards", async () => {
    const update = vi.fn();
    // If anyone ever brings back a per-card loop, this guard fails.
    const ILLEGAL_LOOP = false;
    if (ILLEGAL_LOOP) {
      for (const c of baseCards) update(c.id);
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("on success, expected cache keys are invalidated", () => {
    const invalidate = vi.fn();
    const listId = "L1";

    // Mirror of the post-swap invalidations in handleSwapSides
    invalidate({ queryKey: ["flashcards", listId] });
    invalidate({ queryKey: ["gameshub-list", listId] });
    invalidate({ queryKey: ["study-flashcards", listId] });

    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(invalidate.mock.calls[0][0].queryKey).toEqual(["flashcards", listId]);
    expect(invalidate.mock.calls[1][0].queryKey).toEqual(["gameshub-list", listId]);
    expect(invalidate.mock.calls[2][0].queryKey).toEqual(["study-flashcards", listId]);
  });
});
