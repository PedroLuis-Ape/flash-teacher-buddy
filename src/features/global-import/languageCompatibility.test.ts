import { describe, expect, it } from "vitest";
import {
  importDirectionsMatch,
  normalizeImportLanguage,
  resolveImportLanguageCompatibility,
} from "./languageCompatibility";

describe("languageCompatibility", () => {
  it("normalizes regional tags and common labels", () => {
    expect(normalizeImportLanguage("pt-BR")).toBe("pt");
    expect(normalizeImportLanguage("pt")).toBe("pt");
    expect(normalizeImportLanguage("Português")).toBe("pt");
    expect(normalizeImportLanguage("en-US")).toBe("en");
    expect(normalizeImportLanguage("English")).toBe("en");
  });

  it("treats en/pt-BR and en-US/pt as the same A/B direction", () => {
    expect(importDirectionsMatch(
      { front: "en", back: "pt-BR" },
      { front: "en-US", back: "pt" },
    )).toBe(true);
  });

  it("uses explicit list metadata as absolute authority", () => {
    const result = resolveImportLanguageCompatibility(
      { front: "en", back: "pt-BR" },
      {
        lang_a: "en",
        lang_b: "pt",
        labels_a: "English",
        labels_b: "Português",
        language_settings_mode: "explicit",
      },
      { lang_a: "pt", lang_b: "en" },
    );

    expect(result.compatible).toBe(true);
    expect(result.target).toEqual({ front: "en", back: "pt" });
    expect(result.authorityLabel).toContain("própria da lista");
  });

  it("uses an inherited folder direction when inheritance is explicit", () => {
    const result = resolveImportLanguageCompatibility(
      { front: "en", back: "pt-BR" },
      {
        lang_a: "en",
        lang_b: "pt",
        language_settings_mode: "inherited",
      },
      { lang_a: "pt", lang_b: "en" },
    );

    expect(result.compatible).toBe(false);
    expect(result.target).toEqual({ front: "pt", back: "en" });
  });

  it("accepts stored list A/B metadata as a legacy compatibility bridge", () => {
    const result = resolveImportLanguageCompatibility(
      { front: "en", back: "pt-BR" },
      {
        lang_a: "en",
        lang_b: "pt",
        labels_a: "English",
        labels_b: "Português",
        language_settings_mode: "legacy",
      },
      { lang_a: "pt", lang_b: "en" },
    );

    expect(result.compatible).toBe(true);
    expect(result.matchSource).toBe("legacy-list");
    expect(result.target).toEqual({ front: "en", back: "pt" });
  });
});
