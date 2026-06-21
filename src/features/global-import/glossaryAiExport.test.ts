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
  it("builds a strict prompt with bidirectional and multiple-translation rules", () => {
    const prompt = buildGlossaryAiPrompt(cards, "both");
    expect(prompt).toContain("=== GLOSSÁRIO GLOBAL ===");
    expect(prompt).toContain("=== CARDS ===");
    expect(prompt).toContain("am / sou, estou");
    expect(prompt).toContain("what / o que, qual");
    expect(prompt).toContain("não crie duas linhas espelhadas");
    expect(prompt).toContain("[CARD 1 | LISTA: Rotina][A] I am at home.");
    expect(prompt).toContain("[CARD 1 | LISTA: Rotina][B] Eu estou em casa.");
  });

  it("exports only the requested side", () => {
    const prompt = buildGlossaryAiPrompt(cards.slice(0, 1), "A");
    expect(prompt).toContain("[CARD 1 | LISTA: Rotina][A] I am at home.");
    expect(prompt).not.toContain("[CARD 1 | LISTA: Rotina][B]");
  });

  it("filters by term, translation, list or folder", () => {
    expect(filterGlossarySourceCards(cards, "what")).toHaveLength(1);
    expect(filterGlossarySourceCards(cards, "estou")).toHaveLength(1);
    expect(filterGlossarySourceCards(cards, "perguntas")).toHaveLength(1);
    expect(filterGlossarySourceCards(cards, "inglês básico")).toHaveLength(2);
  });
});
