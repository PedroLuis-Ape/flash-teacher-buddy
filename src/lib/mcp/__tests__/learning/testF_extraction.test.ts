import { describe, expect, it } from "vitest";
import { analyzeTextAgainstLibrary } from "../../learning/analyze";
import { createFixtureVocabularySource } from "./fixtureSource";
import { card, cardId } from "./fixtures";

function texts(items: Array<{ text: string }>): string[] {
  return items.map((item) => item.text.toLowerCase());
}

function statusOf(candidates: Array<{ text: string; status: string }>, text: string): string | undefined {
  return candidates.find((candidate) => candidate.text.toLowerCase() === text)?.status;
}

const LIBRARY = [
  card(cardId(1), "study", { translation: "estudar" }),
  card(cardId(2), "warehouse", { translation: "armazém" }),
  card(cardId(3), "run", { translation: "correr" }),
  card(cardId(4), "look after", { translation: "cuidar de" }),
  card(cardId(5), "look", { translation: "olhar" }),
  card(cardId(6), "favorite", { translation: "favorito" }),
  card(cardId(7), "color", { translation: "cor" }),
  card(cardId(8), "gray", { translation: "cinza" }),
  card(cardId(9), "work", { translation: "trabalhar" }),
  card(cardId(10), "data", { translation: "dados" }),
  card(cardId(11), "café", { translation: "café" }),
];

describe("TEST F - separacao entre conhecido, novo, funcional basico e flexao", () => {
  it("separa conhecidos, flexoes, variantes, basicos e palavras realmente novas", async () => {
    const source = createFixtureVocabularySource({ rows: LIBRARY.slice(), lists: 1 });
    const text =
      "She studies the ledger and ran to look after the warehouse. " +
      "My favourite colour is grey. The invoice arrived for work with data at the cafe.";

    const result = await analyzeTextAgainstLibrary({ text, source });

    expect(result.analyzed_language).toBe("en");
    expect(result.summary.language_confidence).toBe("high");
    expect(result.summary.language_source).toBe("detected");

    // Palavras realmente novas.
    expect(texts(result.new_vocabulary).sort()).toEqual(["arrived", "invoice", "ledger"]);

    // Conhecidas por forma exata.
    expect(statusOf(result.candidates, "warehouse")).toBe("KNOWN_EXACT");
    expect(statusOf(result.candidates, "work")).toBe("KNOWN_EXACT");
    expect(statusOf(result.candidates, "data")).toBe("KNOWN_EXACT");

    // Conhecidas por flexao (lema).
    expect(statusOf(result.candidates, "studies")).toBe("KNOWN_LEMMA");
    expect(statusOf(result.candidates, "ran")).toBe("KNOWN_LEMMA");
    expect(result.candidates.find((candidate) => candidate.text === "studies")?.match?.term).toBe("study");

    // Conhecidas por variante ortografica / de acento.
    expect(statusOf(result.candidates, "favourite")).toBe("KNOWN_VARIANT");
    expect(statusOf(result.candidates, "colour")).toBe("KNOWN_VARIANT");
    expect(statusOf(result.candidates, "grey")).toBe("KNOWN_VARIANT");
    expect(statusOf(result.candidates, "cafe")).toBe("KNOWN_VARIANT");

    // Expressao conhecida casada como unidade.
    expect(statusOf(result.candidates, "look after")).toBe("KNOWN_EXPRESSION");
    // "look" esta dentro da expressao conhecida: nao vira candidato solto.
    expect(result.candidates.some((candidate) => candidate.text.toLowerCase() === "look")).toBe(false);

    // Palavras funcionais basicas ignoradas por padrao.
    expect(statusOf(result.candidates, "the")).toBe("IGNORE_BASIC");
    expect(statusOf(result.candidates, "and")).toBe("IGNORE_BASIC");
    expect(statusOf(result.candidates, "with")).toBe("IGNORE_BASIC");
    expect(result.summary.counts.ignored_basic_unique).toBeGreaterThanOrEqual(8);
    expect(result.summary.ignored_basic_sample).toContain("the");
    expect(texts(result.new_vocabulary)).not.toContain("the");

    // Nada de dump de biblioteca: o payload traz apenas o que aparece no texto.
    const referencedCards = new Set(
      result.candidates
        .map((candidate) => candidate.match?.card_id)
        .filter((value): value is string => Boolean(value)),
    );
    expect(referencedCards.size).toBeLessThan(LIBRARY.length);
    expect(result.summary.library.cards_scanned).toBe(LIBRARY.length);
    expect(result.summary.library.queries).toBeLessThanOrEqual(4);
    expect(result.summary.counts.by_status.NEW).toBe(3);
  });

  it("nao colapsa 'look' em 'look for' (expressao com significado proprio)", async () => {
    const source = createFixtureVocabularySource({ rows: [card(cardId(1), "look", { translation: "olhar" })] });
    const result = await analyzeTextAgainstLibrary({ text: "Look for the invoice.", source });

    const expression = result.candidates.find((candidate) => candidate.text.toLowerCase() === "look for");
    expect(expression?.kind).toBe("expression");
    expect(expression?.status).toBe("NEW");

    const bareWord = result.candidates.find((candidate) => candidate.text.toLowerCase() === "look");
    expect(bareWord?.status).toBe("AMBIGUOUS");
    expect(bareWord?.reason).toBe("word_only_inside_expression");
    expect(bareWord?.match?.term).toBe("look");
    expect(bareWord?.related?.[0]?.term.toLowerCase()).toBe("look for");
    expect(texts(result.ambiguous)).toContain("look");
  });

  it("prefere a expressao conhecida mais longa a palavra isolada", async () => {
    const source = createFixtureVocabularySource({
      rows: [card(cardId(1), "look", { translation: "olhar" }), card(cardId(2), "look after", { translation: "cuidar de" })],
    });
    const result = await analyzeTextAgainstLibrary({ text: "She will look after the dog.", source });

    expect(statusOf(result.candidates, "look after")).toBe("KNOWN_EXPRESSION");
    expect(result.candidates.some((candidate) => candidate.text.toLowerCase() === "look")).toBe(false);
    expect(result.candidates.some((candidate) => candidate.status === "AMBIGUOUS")).toBe(false);
  });

  it("nao inventa expressao para combinacao sintatica basica (look at)", async () => {
    const source = createFixtureVocabularySource({ rows: [card(cardId(1), "look", { translation: "olhar" })] });
    const result = await analyzeTextAgainstLibrary({ text: "Look at the river.", source });

    expect(statusOf(result.candidates, "look")).toBe("KNOWN_EXACT");
    expect(result.candidates.some((candidate) => candidate.text.toLowerCase() === "look at")).toBe(false);
    expect(statusOf(result.candidates, "at")).toBe("IGNORE_BASIC");
    expect(texts(result.new_vocabulary)).toContain("river");
  });

  it("inclui palavras funcionais quando ignore_basic_function_words = false", async () => {
    const source = createFixtureVocabularySource({ rows: [card(cardId(1), "study", { translation: "estudar" })] });
    const result = await analyzeTextAgainstLibrary({
      text: "The study of language matters.",
      source,
      ignoreBasicFunctionWords: false,
    });

    expect(statusOf(result.candidates, "the")).toBe("NEW");
    expect(statusOf(result.candidates, "of")).toBe("NEW");
    expect(result.summary.counts.by_status.IGNORE_BASIC).toBe(0);
    expect(texts(result.new_vocabulary)).toContain("the");
    expect(statusOf(result.candidates, "study")).toBe("KNOWN_EXACT");
  });
});
