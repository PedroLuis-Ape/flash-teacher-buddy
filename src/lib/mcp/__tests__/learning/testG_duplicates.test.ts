import { describe, expect, it } from "vitest";
import { analyzeTextAgainstLibrary } from "../../learning/analyze";
import { createFixtureVocabularySource } from "./fixtureSource";
import { card, cardId } from "./fixtures";

function texts(items: Array<{ text: string }>): string[] {
  return items.map((item) => item.text.toLowerCase());
}

const LIBRARY = [
  card(cardId(1), "bank", {
    translation: "banco (instituição financeira)",
    context_tag: "finance",
    example_text: "I opened an account at the bank.",
  }),
  card(cardId(2), "bank", {
    translation: "margem do rio",
    context_tag: "nature",
    example_text: "We sat on the bank of the river.",
  }),
  card(cardId(3), "look", { translation: "olhar" }),
  card(cardId(4), "look after", { translation: "cuidar de" }),
  card(cardId(5), "receive", { translation: "receber" }),
  card(cardId(6), "work", { translation: "trabalhar" }),
  card(cardId(7), "river bank", { translation: "margem do rio" }),
];

describe("TEST G - duplicata nao e so termo repetido", () => {
  it("nao colapsa sentidos diferentes do mesmo termo e sinaliza como duplicata possivel", async () => {
    const source = createFixtureVocabularySource({ rows: LIBRARY.slice(), lists: 1 });
    const text =
      "I saw a bank near the river bank today. Look after the money. I will recieve the payment for work.";

    const result = await analyzeTextAgainstLibrary({ text, source });

    // O termo existe, mas com DOIS sentidos distintos: nao e "conhecido", e
    // duplicata possivel que exige confirmacao humana.
    const bank = result.candidates.find((candidate) => candidate.text.toLowerCase() === "bank");
    expect(bank?.status).toBe("POSSIBLE_DUPLICATE");
    expect(bank?.reason).toBe("existing_senses_differ");
    expect(bank?.senses?.length).toBe(2);
    expect(bank?.senses?.map((sense) => sense.translation)).toContain("banco (instituição financeira)");
    expect(bank?.senses?.map((sense) => sense.translation)).toContain("margem do rio");
    expect(bank?.match?.sense_count).toBe(2);
    expect(texts(result.new_vocabulary)).not.toContain("bank");

    // "river bank" e uma unidade propria ja cadastrada: casada como expressao,
    // sem gerar "river" nem "bank" soltos a partir dessa ocorrencia.
    expect(
      result.candidates.find((candidate) => candidate.text.toLowerCase() === "river bank")?.status,
    ).toBe("KNOWN_EXPRESSION");
    expect(result.candidates.some((candidate) => candidate.text.toLowerCase() === "river")).toBe(false);

    // Erro de digitacao proximo a um termo conhecido -> duplicata possivel, nao NEW.
    const misspelled = result.candidates.find((candidate) => candidate.text.toLowerCase() === "recieve");
    expect(misspelled?.status).toBe("POSSIBLE_DUPLICATE");
    expect(misspelled?.reason).toBe("near_miss:receive");
    expect(texts(result.new_vocabulary)).not.toContain("recieve");

    // Restante continua sendo vocabulario novo normal.
    expect(texts(result.new_vocabulary)).toEqual(expect.arrayContaining(["money", "payment"]));
    expect(
      result.candidates.find((candidate) => candidate.text.toLowerCase() === "look after")?.status,
    ).toBe("KNOWN_EXPRESSION");
    expect(result.candidates.find((candidate) => candidate.text.toLowerCase() === "work")?.status).toBe("KNOWN_EXACT");
    expect(result.summary.counts.possible_duplicate).toBeGreaterThanOrEqual(2);
    expect(result.summary.notes.join(" ")).toMatch(/duplicar significados/i);
  });

  it("nao transforma palavra curta diferente em duplicata (word != work)", async () => {
    const source = createFixtureVocabularySource({ rows: [card(cardId(1), "work", { translation: "trabalhar" })] });
    const result = await analyzeTextAgainstLibrary({ text: "The word is different from the work.", source });

    expect(result.candidates.find((candidate) => candidate.text.toLowerCase() === "word")?.status).toBe("NEW");
    expect(result.candidates.find((candidate) => candidate.text.toLowerCase() === "work")?.status).toBe("KNOWN_EXACT");
  });

  it("sinaliza palavra contida em expressao conhecida em vez de declarar nova", async () => {
    const source = createFixtureVocabularySource({
      rows: [card(cardId(1), "look after", { translation: "cuidar de" })],
    });
    const result = await analyzeTextAgainstLibrary({ text: "Look at me.", source });

    const look = result.candidates.find((candidate) => candidate.text.toLowerCase() === "look");
    expect(look?.status).toBe("POSSIBLE_DUPLICATE");
    expect(look?.reason).toBe("term_contained_in_known_expression");
    expect(look?.related?.map((ref) => ref.term.toLowerCase())).toContain("look after");
    expect(texts(result.new_vocabulary)).not.toContain("look");
  });
});
