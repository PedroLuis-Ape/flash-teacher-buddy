import { describe, expect, it } from "vitest";
import { buildGlossaryAiPrompt, filterGlossarySourceCards, type GlossarySourceCard } from "./glossaryAiExport";

const cards: GlossarySourceCard[] = [
  {
    id: "1",
    list_id: "list-1",
    term: "I am at home.",
    translation: "Eu estou em casa.",
    list_title: "Rotina",
    folder_title: "Inglês básico",
  },
  {
    id: "2",
    list_id: "list-1",
    term: "What is your name?",
    translation: "Qual é o seu nome?",
    list_title: "Perguntas",
    folder_title: "Inglês básico",
  },
];

describe("glossary AI export", () => {
  it("builds a strict JSON prompt with bidirectional and multiple-translation rules", () => {
    const prompt = buildGlossaryAiPrompt(cards, "both");
    expect(prompt).toContain("app-piteco-glossario.json");
    expect(prompt).toContain("JSON puro e válido");
    expect(prompt).toContain('"schema": "app-piteco-glossary"');
    expect(prompt).toContain('"version": 2');
    expect(prompt).toContain('"translated_text": "sou, estou"');
    expect(prompt).toContain('"translated_text": "o que, qual"');
    expect(prompt).toContain("não crie pares espelhados duplicados");
    expect(prompt).toContain("Não use CSV, TXT, JSONL ou outro formato");
    expect(prompt).toContain("[CARD 1 | PASTA: Inglês básico | LISTA: Rotina][A] I am at home.");
    expect(prompt).toContain("[CARD 1 | PASTA: Inglês básico | LISTA: Rotina][B] Eu estou em casa.");
  });

  it("exports only the requested side", () => {
    const prompt = buildGlossaryAiPrompt(cards.slice(0, 1), "A");
    expect(prompt).toContain('Use side = "A" em todas as entradas.');
    expect(prompt).toContain("[CARD 1 | PASTA: Inglês básico | LISTA: Rotina][A] I am at home.");
    expect(prompt).not.toContain("[CARD 1 | PASTA: Inglês básico | LISTA: Rotina][B]");
  });

  it("filters by term, translation, list or folder", () => {
    expect(filterGlossarySourceCards(cards, "what")).toHaveLength(1);
    expect(filterGlossarySourceCards(cards, "estou")).toHaveLength(1);
    expect(filterGlossarySourceCards(cards, "perguntas")).toHaveLength(1);
    expect(filterGlossarySourceCards(cards, "inglês básico")).toHaveLength(2);
  });
});
