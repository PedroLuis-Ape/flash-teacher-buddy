import { describe, expect, it } from "vitest";
import { analyzeTextAgainstLibrary } from "../../learning/analyze";
import { INVENTORY_PAGE_SIZE } from "../../learning/inventory";
import { createFixtureVocabularySource } from "./fixtureSource";
import { buildScaleLibrary } from "./fixtures";

function texts(items: Array<{ text: string }>): string[] {
  return items.map((item) => item.text.toLowerCase());
}

const TEXT =
  "She studies the warehouse and ran to look after the work. The ledger and the invoice are new.";

/** Teto de round-trips: 2 contagens agregadas + 12 paginas de 1000 cards. */
const QUERY_CEILING = 18;

describe("TEST I - escala: consultas limitadas e tempo aceitavel", () => {
  it("analisa 1000 listas com 12.000 cards sem N consultas", async () => {
    const library = buildScaleLibrary(1000, 12000);
    const source = createFixtureVocabularySource({
      rows: library.rows,
      lists: 1000,
      folderByList: library.folderByList,
    });

    const startedAt = Date.now();
    const result = await analyzeTextAgainstLibrary({ text: TEXT, source });
    const elapsed = Date.now() - startedAt;

    expect(result.summary.library.lists).toBe(1000);
    expect(result.summary.library.cards_scanned).toBe(12000);
    expect(result.summary.library.pages).toBe(12);
    expect(result.summary.library.truncated).toBe(false);

    // Teto de round-trips, e nenhuma consulta por lista.
    expect(source.queryCount()).toBeLessThanOrEqual(QUERY_CEILING);
    expect(result.summary.library.queries).toBeLessThanOrEqual(QUERY_CEILING);
    const pageQueries = source.queries.filter((query) => query.kind === "readCardPage");
    expect(pageQueries).toHaveLength(12);
    expect(
      pageQueries.every(
        (query) => !query.filter?.listIds && !query.filter?.folderIds && query.limit === INVENTORY_PAGE_SIZE,
      ),
    ).toBe(true);
    expect(source.queries.filter((query) => query.kind === "countCards")).toHaveLength(1);
    expect(source.queries.filter((query) => query.kind === "countLists")).toHaveLength(1);

    // Conhecidos de verdade continuam sendo reconhecidos com a biblioteca cheia.
    expect(texts(result.already_known)).toEqual(
      expect.arrayContaining(["studies", "warehouse", "ran", "look after", "work"]),
    );
    expect(texts(result.new_vocabulary)).toEqual(expect.arrayContaining(["ledger", "invoice"]));

    // Tempo aceitavel (build + analise em memoria, sem rede).
    expect(elapsed).toBeLessThan(5000);
    console.log(
      "[TEST I] queries=" +
        source.queryCount() +
        " pages=" +
        result.summary.library.pages +
        " ms=" +
        elapsed +
        " fingerprint=" +
        result.summary.library.fingerprint,
    );
  });

  it("o custo em consultas nao cresce com o numero de listas", async () => {
    const many = buildScaleLibrary(1000, 12000);
    const manySource = createFixtureVocabularySource({
      rows: many.rows,
      lists: 1000,
      folderByList: many.folderByList,
    });
    const few = buildScaleLibrary(50, 12000);
    const fewSource = createFixtureVocabularySource({
      rows: few.rows,
      lists: 50,
      folderByList: few.folderByList,
    });

    const manyResult = await analyzeTextAgainstLibrary({ text: TEXT, source: manySource });
    const fewResult = await analyzeTextAgainstLibrary({ text: TEXT, source: fewSource });

    expect(manySource.queryCount()).toBe(fewSource.queryCount());
    expect(manyResult.summary.library.cards_scanned).toBe(fewResult.summary.library.cards_scanned);
    expect(manyResult.summary.counts).toEqual(fewResult.summary.counts);
    expect(manyResult.new_vocabulary).toEqual(fewResult.new_vocabulary);
  }, 60000);

  it("e deterministico: a mesma biblioteca produz o mesmo resultado", async () => {
    const library = buildScaleLibrary(20, 500);
    const runA = await analyzeTextAgainstLibrary({
      text: TEXT,
      source: createFixtureVocabularySource({
        rows: library.rows.slice(),
        lists: 20,
        folderByList: library.folderByList,
      }),
    });
    const runB = await analyzeTextAgainstLibrary({
      text: TEXT,
      source: createFixtureVocabularySource({
        rows: library.rows.slice(),
        lists: 20,
        folderByList: library.folderByList,
      }),
    });

    expect(runB.candidates).toEqual(runA.candidates);
    expect(runB.summary.library.fingerprint).toBe(runA.summary.library.fingerprint);
    expect(runB.summary.counts).toEqual(runA.summary.counts);
  });
});
