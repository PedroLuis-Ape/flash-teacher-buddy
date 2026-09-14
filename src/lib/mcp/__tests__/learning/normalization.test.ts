import { describe, expect, it } from "vitest";
import { detectLanguage } from "../../learning/language";
import { lemmaKeys } from "../../learning/lemmas";
import {
  editDistanceAtMost,
  normalizeSurface,
  phraseVariants,
  tokenVariants,
  tokenizeText,
} from "../../learning/normalize";

describe("normalizacao linguistica", () => {
  it("aplica casefold, pontuacao e espacos sem perder apostrofo", () => {
    expect(normalizeSurface("  Don't  STOP! ")).toBe("don't stop");
    expect(normalizeSurface("Well-known")).toBe("well-known");
    expect(normalizeSurface("café")).toBe("café");
    expect(normalizeSurface("naïve")).toBe("naïve");
  });

  it("tokeniza palavras, apostrofos e hifens", () => {
    const tokens = tokenizeText("Look after him! Don't stop, well-known writer.", "en");
    expect(tokens.map((token) => token.key)).toEqual([
      "look",
      "after",
      "him",
      "don't",
      "stop",
      "well-known",
      "writer",
    ]);
  });

  it("preserva expressoes com significado proprio como chaves distintas", () => {
    const keys = ["look", "look for", "look after", "look up to"].map((value) => normalizeSurface(value));
    expect(new Set(keys).size).toBe(4);
  });

  it("normaliza contracoes nos dois sentidos", () => {
    expect(phraseVariants(["don't"], "en")).toContain("do not");
    expect(phraseVariants(["do", "not"], "en")).toContain("don't");
    expect(tokenVariants("don't", "en")).toContain("dont");
    expect(phraseVariants(["i", "am"], "en")).toContain("i'm");
  });

  it("normaliza variantes ortograficas e de hifen", () => {
    expect(tokenVariants("colour", "en")).toContain("color");
    expect(tokenVariants("grey", "en")).toContain("gray");
    expect(phraseVariants(["well", "known"], "en")).toContain("well-known");
    expect(tokenVariants("café", "en")).toContain("cafe");
  });

  it("preserva acentos do portugues na chave exata (variante, nao igualdade)", () => {
    expect(normalizeSurface("está")).not.toBe(normalizeSurface("esta"));
    expect(tokenVariants("está", "pt")).toContain("esta");
    expect(phraseVariants(["do"], "pt")).toContain("de o");
  });

  it("lematiza plural, flexao verbal e irregulares", () => {
    expect(lemmaKeys("studies", "en")).toContain("study");
    expect(lemmaKeys("warehouses", "en")).toContain("warehouse");
    expect(lemmaKeys("ran", "en")).toContain("run");
    expect(lemmaKeys("children", "en")).toContain("child");
    expect(lemmaKeys("achieved", "en")).toContain("achieve");
    expect(lemmaKeys("casas", "pt")).toContain("casa");
    expect(lemmaKeys("comendo", "pt")).toContain("comer");
    expect(lemmaKeys("foi", "pt")).toEqual(expect.arrayContaining(["ser", "ir"]));
  });

  it("mede distancia de edicao com corte (para duplicata possivel)", () => {
    expect(editDistanceAtMost("recieve", "receive", 1)).toBe(1);
    expect(editDistanceAtMost("word", "work", 1)).toBe(1);
    expect(editDistanceAtMost("ledger", "leger", 1)).toBe(1);
    expect(editDistanceAtMost("warehouse", "warehous", 1)).toBe(1);
    expect(editDistanceAtMost("warehouse", "warehouse", 2)).toBe(0);
    expect(editDistanceAtMost("warehouse", "warehous", 0)).toBeNull();
  });

  it("detecta idioma com evidencia observavel", () => {
    const english = detectLanguage(tokenizeText("She is the best student and she has a book", "en"));
    expect(english.language).toBe("en");
    expect(english.confidence).toBe("high");

    const portuguese = detectLanguage(
      tokenizeText("Ela não está na escola porque a sua mãe trabalha muito", "pt"),
    );
    expect(portuguese.language).toBe("pt");
    expect(portuguese.confidence).toBe("high");
  });
});
