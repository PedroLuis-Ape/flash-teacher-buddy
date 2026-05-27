import { describe, it, expect } from "vitest";
import { parseLayeredInput, suggestMainTitle, extractCamadasBlock } from "./layeredImport";

describe("parseLayeredInput — Format A (header + indented)", () => {
  it("parses a single header with three layers", () => {
    const input = [
      "get",
      "  pegar / conseguir | I got a new phone. | Eu consegui um celular novo.",
      "  entender | I get it. | Eu entendi.",
      "  chegar | I got home late. | Eu cheguei em casa tarde.",
    ].join("\n");
    const { groups } = parseLayeredInput(input);
    expect(groups).toHaveLength(1);
    expect(groups[0].term).toBe("get");
    expect(groups[0].layers).toHaveLength(3);
    expect(groups[0].layers[0]).toMatchObject({
      translation: "pegar / conseguir",
      example: "I got a new phone.",
      exampleTranslation: "Eu consegui um celular novo.",
    });
    expect(groups[0].layers[2].translation).toBe("chegar");
  });

  it("ignores headers with no children", () => {
    const { groups } = parseLayeredInput("get\n");
    expect(groups).toHaveLength(0);
  });
});

describe("parseLayeredInput — Format B (repeated term)", () => {
  it("groups consecutive lines that share term", () => {
    const input = [
      "get | pegar | I got a phone. | Eu peguei um celular.",
      "get | entender | I get it. | Eu entendi.",
      "go | ir | I go home. | Eu vou pra casa.",
    ].join("\n");
    const { groups, leftover } = parseLayeredInput(input);
    expect(groups).toHaveLength(1);
    expect(groups[0].term).toBe("get");
    expect(groups[0].layers).toHaveLength(2);
    expect(leftover.some((l) => l.includes("go"))).toBe(true);
  });

  it("does not group when only one occurrence", () => {
    const input = "get | pegar | I got it. | Eu peguei.";
    const { groups } = parseLayeredInput(input);
    expect(groups).toHaveLength(0);
  });
});

describe("suggestMainTitle", () => {
  it("returns longest common prefix when meaningful", () => {
    expect(suggestMainTitle(["running", "runner", "runs"])).toBe("run");
  });
  it("falls back to first term when prefix too short", () => {
    expect(suggestMainTitle(["abc", "xyz"])).toBe("abc");
  });
  it("handles single term", () => {
    expect(suggestMainTitle(["hello"])).toBe("hello");
  });
});

describe("extractCamadasBlock", () => {
  it("returns found=false and untouched input when no [CAMADAS] marker", () => {
    const input = "house / casa\ndog / cachorro";
    const r = extractCamadasBlock(input);
    expect(r.found).toBe(false);
    expect(r.groups).toHaveLength(0);
    expect(r.cleanedInput).toBe(input);
    expect(r.singletonWarnings).toHaveLength(0);
    expect(r.sentenceWarnings).toHaveLength(0);
  });

  it("separates normal cards from [CAMADAS] block and groups repeated terms", () => {
    const input = [
      "=== CARDS ===",
      "",
      "house / casa",
      "dog / cachorro",
      "",
      "[CAMADAS]",
      "work / trabalhar",
      "work / funcionar",
      "work / dar certo",
    ].join("\n");

    const r = extractCamadasBlock(input);
    expect(r.found).toBe(true);
    // Normal-card lines must remain in cleanedInput.
    expect(r.cleanedInput).toContain("house / casa");
    expect(r.cleanedInput).toContain("dog / cachorro");
    // [CAMADAS] block must NOT leak into cleanedInput.
    expect(r.cleanedInput).not.toContain("[CAMADAS]");
    expect(r.cleanedInput).not.toContain("work / trabalhar");

    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].term).toBe("work");
    expect(r.groups[0].layers).toHaveLength(3);
    expect(r.groups[0].layers.map((L) => L.translation)).toEqual([
      "trabalhar",
      "funcionar",
      "dar certo",
    ]);
  });

  it("groups multiple distinct terms inside the same [CAMADAS] block", () => {
    const input = [
      "[CAMADAS]",
      "work / trabalhar",
      "work / funcionar",
      "look up / pesquisar",
      "look up / admirar",
    ].join("\n");

    const r = extractCamadasBlock(input);
    expect(r.groups).toHaveLength(2);
    const work = r.groups.find((g) => g.term === "work")!;
    const lookUp = r.groups.find((g) => g.term === "look up")!;
    expect(work.layers).toHaveLength(2);
    expect(lookUp.layers).toHaveLength(2);
  });

  it("does NOT create a layered card when a term appears only once; moves it back to normal cards", () => {
    const input = [
      "house / casa",
      "[CAMADAS]",
      "work / trabalhar",
      "work / funcionar",
      "lonely / sozinho",
    ].join("\n");

    const r = extractCamadasBlock(input);
    expect(r.found).toBe(true);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].term).toBe("work");
    expect(r.singletonWarnings).toEqual(["lonely"]);
    // Singleton line falls back into cleanedInput as a normal card.
    expect(r.cleanedInput).toContain("lonely / sozinho");
    expect(r.cleanedInput).toContain("house / casa");
  });

  it("warns when the left side inside [CAMADAS] looks like a full sentence", () => {
    const input = [
      "[CAMADAS]",
      "I work every day / Eu trabalho todos os dias.",
      "I work every day / Trabalho todo dia.",
    ].join("\n");

    const r = extractCamadasBlock(input);
    expect(r.sentenceWarnings.length).toBeGreaterThan(0);
    expect(r.sentenceWarnings[0]).toContain("I work every day");
  });

  it("ends [CAMADAS] block at the next === marker", () => {
    const input = [
      "[CAMADAS]",
      "work / trabalhar",
      "work / funcionar",
      "=== CARDS ===",
      "house / casa",
    ].join("\n");

    const r = extractCamadasBlock(input);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].term).toBe("work");
    // Section after the block must be preserved as normal cards.
    expect(r.cleanedInput).toContain("=== CARDS ===");
    expect(r.cleanedInput).toContain("house / casa");
  });
});