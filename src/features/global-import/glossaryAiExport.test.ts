import { describe, expect, it } from "vitest";
import {
  addGlossaryWordInventory,
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
    term: "The website offers replica at affordable prices.",
    translation: "O site oferece réplicas a preços acessíveis.",
    list_title: "Compras",
    folder_title: "Inglês básico",
  },
  {
    id: "2",
    list_id: "list-1",
    term: "The prices are affordable.",
    translation: "Os preços são acessíveis.",
    list_title: "Compras",
    folder_title: "Inglês básico",
  },
];

describe("glossary AI export", () => {
  it("requires every unique word once and keeps chunks additive", () => {
    const prompt = buildGlossaryAiPrompt(cards, "A");
    expect(prompt).toContain("INVENTÁRIO OBRIGATÓRIO DE PALAVRAS ÚNICAS");
    expect(prompt).toContain("[A] the");
    expect(prompt).toContain("[A] website");
    expect(prompt).toContain("[A] offers");
    expect(prompt).toContain("[A] replica");
    expect(prompt).toContain("[A] at");
    expect(prompt).toContain("[A] affordable");
    expect(prompt).toContain("[A] prices");
    expect(prompt.match(/\[A\] the/g)).toHaveLength(1);
    expect(prompt).toContain("Chunks são adicionais: nunca substituem as palavras individuais");
    expect(prompt).toContain('"original_text": "affordable prices"');
  });

  it("builds a strict JSON response contract", () => {
    const prompt = buildGlossaryAiPrompt(cards, "both");
    expect(prompt).toContain("app-piteco-glossario.json");
    expect(prompt).toContain('"schema": "app-piteco-glossary"');
    expect(prompt).toContain('"version": 2');
    expect(prompt).toContain("Não use Markdown, CSV, TXT, JSONL");
    expect(prompt.endsWith(GLOSSARY_AI_PROMPT_FOOTER)).toBe(true);
  });

  it("deduplicates inventory by side and normalized spelling", () => {
    const inventory = addGlossaryWordInventory(cards, "both");
    expect(inventory.has("A|the")).toBe(true);
    expect(Array.from(inventory.values()).filter((item) => item.side === "A" && item.text === "the")).toHaveLength(1);
    expect(inventory.has("B|preços")).toBe(true);
  });

  it("keeps card numbering continuous across streamed batches", () => {
    const first = buildGlossaryAiSourceChunk(cards.slice(0, 1), "A", 0);
    const second = buildGlossaryAiSourceChunk(cards.slice(1), "A", 1);
    expect(first).toContain("[CARD 1");
    expect(second).toContain("[CARD 2");
  });

  it("segments a 34,000-card export and appends the inventory", () => {
    const largeCatalog = Array.from({ length: 34_000 }, (_, index) => ({
      ...cards[index % cards.length],
      id: String(index),
    }));
    const parts = buildGlossaryAiPromptParts(largeCatalog, "both", 1000);
    expect(parts).toHaveLength(37);
    expect(parts.at(-1)).toContain(GLOSSARY_AI_PROMPT_FOOTER);
    expect(String(parts[1])).toContain("[CARD 1");
    expect(String(parts[34])).toContain("[CARD 33001");
    expect(String(parts[36])).toContain("[A] affordable");
  });

  it("filters by term, translation, list or folder", () => {
    expect(filterGlossarySourceCards(cards, "replica")).toHaveLength(1);
    expect(filterGlossarySourceCards(cards, "acessíveis")).toHaveLength(2);
    expect(filterGlossarySourceCards(cards, "compras")).toHaveLength(2);
    expect(filterGlossarySourceCards(cards, "inglês básico")).toHaveLength(2);
  });
});
