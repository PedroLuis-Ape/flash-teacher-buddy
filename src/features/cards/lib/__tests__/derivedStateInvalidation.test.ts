/**
 * Regressao da secao 26 — invalidez de estado derivado quando o conteudo muda.
 *
 * Cobre a regra: SOURCE DATA (flashcards) -> FLASHCARD IDS -> DERIVED STATE.
 * Quando o card deixa de existir (ou vai para a lixeira), nenhuma feature pode
 * continuar tratando a referencia antiga como valida.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  chunkIds,
  fetchLiveFlashcardIdSet,
  filterLiveFlashcardIds,
  retainLiveFlashcardIds,
  type FlashcardLivenessRow,
} from "../liveFlashcardIds";

const migration = readFileSync(
  "supabase/migrations/20260919120000_flashcard_derived_state_invalidation_v1.sql",
  "utf8",
);

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

function mockClient(rows: FlashcardLivenessRow[]) {
  const asked: string[][] = [];
  return {
    asked,
    from(table: string) {
      expect(table).toBe("flashcards");
      return {
        select: () => ({
          in: (_column: string, value: string[]) => {
            asked.push([...value]);
            return Promise.resolve({
              data: rows.filter((row) => value.includes(row.id)),
              error: null,
            });
          },
        }),
      };
    },
  };
}

describe("flashcard liveness filter", () => {
  it("drops soft-deleted and missing cards while preserving order", () => {
    const rows: FlashcardLivenessRow[] = [
      { id: "a", deleted_at: null },
      { id: "b", deleted_at: "2026-09-19T00:00:00.000Z" },
    ];
    expect(filterLiveFlashcardIds(["b", "a", "gone", "a"], rows)).toEqual(["a"]);
  });

  it("treats a card without deleted_at column value as alive", () => {
    expect(filterLiveFlashcardIds(["a"], [{ id: "a" }])).toEqual(["a"]);
  });

  it("chunks ids without duplicating them", () => {
    expect(chunkIds(["a", "b", "a", "c"], 2)).toEqual([["a", "b"], ["c"]]);
    expect(chunkIds([], 2)).toEqual([]);
  });

  it("queries every chunk and returns only live ids", async () => {
    const client = mockClient([
      { id: "a", deleted_at: null },
      { id: "b", deleted_at: "2026-01-01" },
      { id: "c", deleted_at: null },
    ]);
    const ids = Array.from({ length: 250 }, (_, index) => `id-${index}`).concat(["a", "b", "c"]);
    const live = await fetchLiveFlashcardIdSet(ids, client);
    expect(Array.from(live).sort()).toEqual(["a", "c"]);
    expect(client.asked).toHaveLength(2);
    expect(client.asked[0]).toHaveLength(200);
  });

  it("retains input order and never repeats an id", async () => {
    const client = mockClient([
      { id: "a", deleted_at: null },
      { id: "b", deleted_at: null },
    ]);
    expect(await retainLiveFlashcardIds(["b", "a", "b", "dead"], client)).toEqual(["b", "a"]);
  });

  it("returns nothing for an empty input without querying", async () => {
    const client = mockClient([]);
    expect(await retainLiveFlashcardIds([], client)).toEqual([]);
    expect(client.asked).toHaveLength(0);
  });
});

describe("derived state reads revalidate card identity", () => {
  const consumers: Array<[string, string]> = [
    ["src/hooks/useFavorites.ts", "retainLiveFlashcardIds"],
    ["src/hooks/useRedList.ts", "retainLiveFlashcardIds"],
    ["src/hooks/useSpecialFlashcards.ts", "fetchLiveFlashcardIdSet"],
    ["src/hooks/useReinforcement.ts", "fetchLiveFlashcardIdSet"],
    ["src/hooks/useFlashcardReviewFlags.ts", "retainLiveFlashcardIds"],
  ];

  it.each(consumers)("%s filters dead cards", (path, marker) => {
    const source = readSource(path);
    expect(source).toContain("features/cards/lib/liveFlashcardIds");
    expect(source).toContain(marker);
  });

  it("attention point details join only live cards", () => {
    const source = readSource("src/hooks/useSpecialFlashcards.ts");
    expect(source).toContain(".is('deleted_at', null);");
  });

  it("counts never come from raw active rows", () => {
    const source = readSource("src/hooks/useSpecialFlashcards.ts");
    const countSection = source.slice(source.indexOf("useSpecialFlashcardsCount"));
    expect(countSection).toContain("groups.size");
    expect(countSection.slice(0, countSection.indexOf("useToggleSpecialFlashcard"))).not.toContain("enhanced.count");
  });

  it("resume pointer requires a list that still has a live card", () => {
    const source = readSource("src/hooks/useLatestStudyResume.ts");
    expect(source).toContain("listHasLiveCards");
    expect(source).toContain(".is(\"deleted_at\", null)");
    expect(source).toContain("resume.resourceId");
  });

  it("study session restore keeps only eligible ids", () => {
    const source = readSource("src/features/study/lib/restoreStudySession.ts");
    expect(source).toContain("eligible.has(id)");
    expect(source).toContain("cardsOrder.push(...eligibleIds.filter");
  });
});

describe("canonical invalidation migration", () => {
  it("prunes orphan derived state for the current user", () => {
    expect(migration).toContain("public.prune_my_orphan_flashcard_derived_state_v1");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.prune_my_orphan_flashcard_derived_state_v1() TO authenticated;");
    expect(migration).toContain("NOT EXISTS (SELECT 1 FROM public.flashcards");
  });

  it("touches every derived surface that references card ids", () => {
    expect(migration).toContain("public.user_favorites");
    expect(migration).toContain("public.user_red_list");
    expect(migration).toContain("public.user_special_flashcards");
    expect(migration).toContain("public.user_flashcard_review_flags");
    expect(migration).toContain("public.user_reinforcement_points");
    expect(migration).toContain("public.flashcard_progress");
  });

  it("deactivates instead of destroying history", () => {
    expect(migration).toContain("SET is_active = false, deactivated_at = COALESCE(s.deactivated_at, now())");
    expect(migration).toContain("SET is_active = false, deactivated_at = now(), updated_at = now()");
  });

  it("cleans generic favorites on hard delete because they have no FK", () => {
    expect(migration).toContain("CREATE TRIGGER trg_prune_flashcard_favorites_v1");
    expect(migration).toContain("AFTER DELETE ON public.flashcards");
    expect(migration).toContain("resource_type = 'flashcard'");
  });

  it("documents rollback and does not delete state for soft-deleted cards", () => {
    expect(migration).toContain("ROLLBACK");
    expect(migration).toContain("estado derivado de card apenas soft-deleted");
  });
});

describe("content mutation invalidates derived state", () => {
  it("single and bulk card delete invalidate every dependent surface", () => {
    const source = readSource("src/pages/ListDetail.tsx");
    expect(source).toContain("invalidateFlashcardDerivedState(queryClient)");
    expect(source).toContain("pruneOrphanFlashcardDerivedState()");
  });

  it("undo restores the derived reads instead of leaving stale cache", () => {
    const source = readSource("src/pages/ListDetail.tsx");
    expect(source).toContain("invalidateFlashcardDerivedState(queryClient); }");
  });

  it("permanent delete and empty trash prune orphans", () => {
    const source = readSource("src/hooks/useTrash.ts");
    expect(source).toContain("pruneOrphanFlashcardDerivedState()");
    expect(source).toContain("invalidateFlashcardDerivedState(queryClient)");
  });

  it("cache prefixes cover favorites, red list, attention, reinforcement and resume", () => {
    const source = readSource("src/features/cards/lib/derivedStateInvalidation.ts");
    for (const key of [
      "favorites",
      "red-list",
      "special-flashcards",
      "flashcard-review-flags",
      "reinforcement",
      "study-resume",
    ]) {
      expect(source).toContain('"' + key + '"');
    }
  });

  it("prune tolerates the migration not being applied yet", () => {
    const source = readSource("src/features/cards/lib/derivedStateInvalidation.ts");
    expect(source).toContain("PGRST202");
    expect(source).toContain("42883");
  });
});
