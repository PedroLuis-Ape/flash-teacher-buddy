import { describe, expect, it } from "vitest";
import { resolveDeckOrientation, resolveEffectiveSideLabels } from "./resolveDeckOrientation";

// Cards REAIS da lista a1c6d475-3a69-4b7e-9f7b-877d2480b5f6 (produção, leitura em 2026-09-13).
// A lista declara lang_a='en' / lang_b='pt', mas o conteúdo está invertido: term=pt, translation=en.
const REAL_DECK = [
  { term: "Eles são meus pais", translation: "They are my parents" },
  { term: "Hoje é segunda-feira", translation: "Today is Monday" },
  { term: "Eu estou feliz", translation: "I am happy" },
  { term: "Ela está na escola", translation: "She is at school" },
  { term: "Ele é muito alto", translation: "He is very tall" },
  { term: "Eles estão cansados", translation: "They are tired" },
  { term: "Vocês estão na sala de estar", translation: "You are in the living room" },
  { term: "Ela é muito inteligente", translation: "She is very smart" },
  { term: "O filme é interessante", translation: "The movie is interesting" },
  { term: "Está frio", translation: "It is cold" },
  { term: "Eu sou o Pedro", translation: "I am Pedro" },
  { term: "Vocês são professores", translation: "You are teachers" },
  { term: "A loja está aberta", translation: "The store is open" },
  { term: "Ele é meu irmão", translation: "He is my brother" },
];

describe("deck real da lista a1c6d475 (conteúdo invertido vs metadata)", () => {
  it("reconhece a inversão com evidência forte e troca os idiomas efetivos", () => {
    const result = resolveDeckOrientation({ langA: "en", langB: "pt", cards: REAL_DECK });
    expect(result.inverted).toBe(true);
    expect(result.evidence.classifiedCards).toBeGreaterThanOrEqual(8);
    expect(result.evidence.inversionRatio).toBeGreaterThanOrEqual(0.8);
    expect(result.langA).toBe("pt");
    expect(result.langB).toBe("en");
  });

  it("mantem os labels colados ao lado apos a inversao", () => {
    const labels = resolveEffectiveSideLabels({ labelA: "English", labelB: "Português", inverted: true });
    expect(labels).toEqual({ labelA: "Português", labelB: "English" });
  });

  it("nao inverte com amostra pequena (3 cards)", () => {
    const result = resolveDeckOrientation({ langA: "en", langB: "pt", cards: REAL_DECK.slice(0, 3) });
    expect(result.inverted).toBe(false);
    expect(result.langA).toBe("en");
  });

  it("nao inverte com cards triviais de uma palavra (regressao apontada na revisao)", () => {
    const trivial = Array.from({ length: 10 }, () => ({ term: "com", translation: "the" }));
    const result = resolveDeckOrientation({ langA: "en", langB: "pt", cards: trivial });
    expect(result.inverted).toBe(false);
    expect(result.evidence.classifiedCards).toBe(0);
  });
});
