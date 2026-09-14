import { describe, expect, it } from "vitest";
import { analyzeTextAgainstLibrary } from "../../learning/analyze";
import { invalidateVocabularyInventory } from "../../learning/inventory";
import { createFixtureVocabularySource } from "./fixtureSource";
import { card, cardId } from "./fixtures";

function texts(items: Array<{ text: string }>): string[] {
  return items.map((item) => item.text.toLowerCase());
}

describe("TEST H - depois de criar, a mesma palavra deixa de ser nova", () => {
  it("reconhece os cards criados e invalida o inventario em cache", async () => {
    const cacheKey = "user-H";
    const rows = [
      card(cardId(1), "study", { translation: "estudar" }),
      card(cardId(2), "work", { translation: "trabalhar" }),
    ];
    const source = createFixtureVocabularySource({ rows, lists: 1 });
    const text = "I study the ledger and the invoice.";

    const first = await analyzeTextAgainstLibrary({ text, source, cacheKey });
    expect(first.summary.library.from_cache).toBe(false);
    expect(texts(first.new_vocabulary).sort()).toEqual(["invoice", "ledger"]);
    expect(first.summary.library.fingerprint).toMatch(/^v1-en-/);

    // "Criar" e outro fluxo (nao esta tool): aqui simulamos adicionando ao fixture.
    rows.push(
      card(cardId(3), "ledger", { translation: "livro razão" }),
      card(cardId(4), "invoice", { translation: "fatura" }),
    );

    // Sem invalidar, o cache devolve o inventario anterior: contrato explicito,
    // e por isso que todo fluxo de escrita deve invalidar.
    const stale = await analyzeTextAgainstLibrary({ text, source, cacheKey });
    expect(stale.summary.library.from_cache).toBe(true);
    expect(texts(stale.new_vocabulary)).toContain("ledger");

    invalidateVocabularyInventory(cacheKey);
    const after = await analyzeTextAgainstLibrary({ text, source, cacheKey });
    expect(after.summary.library.from_cache).toBe(false);
    expect(after.summary.library.fingerprint).not.toBe(first.summary.library.fingerprint);
    expect(texts(after.new_vocabulary)).not.toContain("ledger");
    expect(texts(after.new_vocabulary)).not.toContain("invoice");
    expect(after.new_vocabulary).toHaveLength(0);
    expect(after.candidates.find((candidate) => candidate.text.toLowerCase() === "ledger")?.status).toBe(
      "KNOWN_EXACT",
    );
    expect(after.candidates.find((candidate) => candidate.text.toLowerCase() === "invoice")?.status).toBe(
      "KNOWN_EXACT",
    );
    expect(after.summary.library.cards_scanned).toBe(4);
  });
});
