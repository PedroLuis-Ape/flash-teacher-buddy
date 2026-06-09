import { describe, it, expect } from "vitest";
import {
  SUPPORTED_LANGUAGES,
  normalizeLangCode,
  toBCP47,
  getLangLabel,
  getLanguageFlag,
  isSupportedLanguage,
  getDefaultLangA,
  getDefaultLangB,
} from "./languages";

describe("languages registry", () => {
  it("ships the documented set of short codes", () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    for (const c of ["en","pt","es","fr","de","it","ja","zh","ko","ru","ar","hi"]) {
      expect(codes).toContain(c);
    }
  });
});

describe("toBCP47", () => {
  it("maps short codes to canonical locales", () => {
    expect(toBCP47("en")).toBe("en-US");
    expect(toBCP47("pt")).toBe("pt-BR");
    expect(toBCP47("es")).toBe("es-ES");
    expect(toBCP47("fr")).toBe("fr-FR");
    expect(toBCP47("de")).toBe("de-DE");
    expect(toBCP47("it")).toBe("it-IT");
    expect(toBCP47("ja")).toBe("ja-JP");
    expect(toBCP47("zh")).toBe("zh-CN");
    expect(toBCP47("ko")).toBe("ko-KR");
    expect(toBCP47("ru")).toBe("ru-RU");
    expect(toBCP47("ar")).toBe("ar-SA");
    expect(toBCP47("hi")).toBe("hi-IN");
  });

  it("preserves regional BCP-47 variants", () => {
    expect(toBCP47("en-GB")).toBe("en-GB");
    expect(toBCP47("es-MX")).toBe("es-MX");
    expect(toBCP47("pt-PT")).toBe("pt-PT");
    expect(toBCP47("fr-CA")).toBe("fr-CA");
  });

  it("canonicalises casing", () => {
    expect(toBCP47("EN-gb")).toBe("en-GB");
    expect(toBCP47("PT-pt")).toBe("pt-PT");
  });

  it("never throws on garbage input", () => {
    expect(() => toBCP47("")).not.toThrow();
    expect(() => toBCP47(null as unknown as string)).not.toThrow();
    expect(() => toBCP47("something-weird")).not.toThrow();
  });
});

describe("normalizeLangCode", () => {
  it("recognises short codes", () => {
    expect(normalizeLangCode("en")).toBe("en");
    expect(normalizeLangCode("PT")).toBe("pt");
  });
  it("preserves regional tags with canonical casing", () => {
    expect(normalizeLangCode("en-gb")).toBe("en-GB");
    expect(normalizeLangCode("es-mx")).toBe("es-MX");
  });
  it("falls back safely for free text", () => {
    expect(normalizeLangCode("Japonês")).toBe("japonês");
  });
});

describe("getLangLabel", () => {
  it("returns native labels for short codes", () => {
    expect(getLangLabel("en")).toBe("English");
    expect(getLangLabel("pt")).toBe("Português");
    expect(getLangLabel("es")).toBe("Español");
    expect(getLangLabel("fr")).toBe("Français");
    expect(getLangLabel("de")).toBe("Deutsch");
  });
  it("falls back to base language for regional variants", () => {
    expect(getLangLabel("en-GB")).toBe("English");
    expect(getLangLabel("pt-PT")).toBe("Português");
    expect(getLangLabel("es-MX")).toBe("Español");
  });
});

describe("getLanguageFlag", () => {
  it("returns flag for known short codes", () => {
    expect(getLanguageFlag("en")).toBe("🇺🇸");
    expect(getLanguageFlag("pt")).toBe("🇧🇷");
  });
  it("falls back to globe for unknown", () => {
    expect(getLanguageFlag("xx")).toBe("🌍");
  });
});

describe("isSupportedLanguage", () => {
  it("accepts short codes and BCP-47 tags", () => {
    expect(isSupportedLanguage("en")).toBe(true);
    expect(isSupportedLanguage("en-GB")).toBe(true);
    expect(isSupportedLanguage("pt-PT")).toBe(true);
  });
  it("rejects clearly invalid input", () => {
    expect(isSupportedLanguage("")).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
  });
});

describe("defaults", () => {
  it("provides sensible defaults", () => {
    expect(getDefaultLangA()).toBe("en");
    expect(getDefaultLangB()).toBe("pt");
  });
});