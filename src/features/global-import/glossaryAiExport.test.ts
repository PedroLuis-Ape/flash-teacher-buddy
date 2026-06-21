import { describe, expect, it } from "vitest";
import {
  buildGlossaryAiPrompt,
  buildGlossaryAiPromptParts,
  buildGlossaryAiSourceChunk,
  filterGlossarySourceCards,
  GLOSSARY_AI_PROMPT_FOOTER,
  type GlossarySourceCard,
} from "./glossaryAiExport";

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
    expect(prompt.endsWith(GLOSSARY_AI_PROMPT_FOOTER)).toBe(true);
  });

  it("exports only the requested side", () => {
    const prompt = buildGlossaryAiPrompt(cards.slice(0, 1), "A");
    expect(prompt).toContain('Use side = "A" em todas as entradas.');
    expect(prompt).toContain("[CARD 1 | PASTA: Inglês básico | LISTA: Rotina][A] I am at home.");
    expect(prompt).not.toContain("[CARD 1 | PASTA: Inglês básico | LISTA: Rotina][B]");
  });

  it("keeps card numbering continuous across streamed batches", () => {
    const first = buildGlossaryAiSourceChunk(cards.slice(0, 1), "A", 0);
    const second = buildGlossaryAiSourceChunk(cards.slice(1), "A", 1);
    expect(first).toContain("[CARD 1");
    expect(second).toContain("[CARD 2");
  });

  it("segments a 34,000-card export instead of building one giant source string", () => {
    const largeCatalog = Array.from({ length: 34_000 }, (_, index) => ({
      ...cards[index % cards.length],
      id: String(index),
    }));
    const parts = buildGlossaryAiPromptParts(largeCatalog, "both", 1000);
    expect(parts).toHaveLength(36);
    expect(parts.at(-1)).toBe(GLOSSARY_AI_PROMPT_FOOTER);
    expect(String(parts[1])).toContain("[CARD 1");
    expect(String(parts[34])).toContain("[CARD 33001");
  });

  it("filters by term, translation, list or folder", () => {
    expect(filterGlossarySourceCards(cards, "what")).toHaveLength(1);
    expect(filterGlossarySourceCards(cards, "estou")).toHaveLength(1);
    expect(filterGlossarySourceCards(cards, "perguntas")).toHaveLength(1);
    expect(filterGlossarySourceCards(cards, "inglês básico")).toHaveLength(2);
  });
});
