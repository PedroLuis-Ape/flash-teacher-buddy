import { describe, it, expect } from "vitest";
import {
  resolveStudySides,
  getLangLabel,
  resolveEffectiveListSettings,
} from "./resolveStudySides";

// ── resolveStudySides ────────────────────────────────────────────────

describe("resolveStudySides", () => {
  const sideA = { text: "Bonjour", lang: "fr", label: "Français" };
  const sideB = { text: "Hello", lang: "en", label: "English" };

  it("en-pt direction → sideA is prompt", () => {
    const { promptSide, answerSide, isAFirst } = resolveStudySides(sideA, sideB, "en-pt");
    expect(isAFirst).toBe(true);
    expect(promptSide.text).toBe("Bonjour");
    expect(answerSide.text).toBe("Hello");
  });

  it("pt-en direction → sideB is prompt", () => {
    const { promptSide, answerSide, isAFirst } = resolveStudySides(sideA, sideB, "pt-en");
    expect(isAFirst).toBe(false);
    expect(promptSide.text).toBe("Hello");
    expect(answerSide.text).toBe("Bonjour");
  });

  it("any direction → deterministic per card", () => {
    const r1 = resolveStudySides(sideA, sideB, "any", "card-1");
    const r2 = resolveStudySides(sideA, sideB, "any", "card-1");
    expect(r1.isAFirst).toBe(r2.isAFirst); // deterministic
  });
});

// ── getLangLabel ──────────────────────────────────────────────────────

describe("getLangLabel", () => {
  it("returns correct labels for known codes", () => {
    expect(getLangLabel("fr")).toBe("Français");
    expect(getLangLabel("en")).toBe("English");
    expect(getLangLabel("pt")).toBe("Português");
    expect(getLangLabel("de")).toBe("Deutsch");
    expect(getLangLabel("ja")).toBe("日本語");
  });

  it("returns uppercased code for unknown", () => {
    expect(getLangLabel("xx")).toBe("XX");
  });
});

// ── resolveEffectiveListSettings ─────────────────────────────────────

describe("resolveEffectiveListSettings", () => {
  it("uses list settings when explicitly overridden", () => {
    const list = { lang_a: "fr", lang_b: "en", labels_a: "Français", labels_b: "English" };
    const folder = { lang_a: "es", lang_b: "pt", labels_a: "Español", labels_b: "Português" };
    const result = resolveEffectiveListSettings(list, folder);

    expect(result.langA).toBe("fr");
    expect(result.langB).toBe("en");
    expect(result.labelsA).toBe("Français");
    expect(result.labelsB).toBe("English");
    expect(result.isListOverride).toBe(true);
  });

  it("falls back to folder when list has bare defaults (en/pt)", () => {
    const list = { lang_a: "en", lang_b: "pt" };
    const folder = { lang_a: "fr", lang_b: "en", labels_a: "Français", labels_b: "English" };
    const result = resolveEffectiveListSettings(list, folder);

    expect(result.langA).toBe("fr");
    expect(result.langB).toBe("en");
    expect(result.labelsA).toBe("Français");
    expect(result.labelsB).toBe("English");
    expect(result.isListOverride).toBe(false);
  });

  it("falls back to folder when list has null langs", () => {
    const list = { lang_a: null, lang_b: null };
    const folder = { lang_a: "de", lang_b: "ja", labels_a: "Deutsch", labels_b: "日本語" };
    const result = resolveEffectiveListSettings(list, folder);

    expect(result.langA).toBe("de");
    expect(result.langB).toBe("ja");
    expect(result.isListOverride).toBe(false);
  });

  it("uses bare defaults when neither list nor folder have config", () => {
    const result = resolveEffectiveListSettings(null, null);
    expect(result.langA).toBe("en");
    expect(result.langB).toBe("pt");
    expect(result.labelsA).toBe("English");
    expect(result.labelsB).toBe("Português");
  });

  it("derives labels from getLangLabel when labels are missing", () => {
    const list = { lang_a: "ko", lang_b: "ru" };
    const result = resolveEffectiveListSettings(list, null);
    expect(result.labelsA).toBe("한국어");
    expect(result.labelsB).toBe("Русский");
  });

  // ── Round-trip consistency tests ─────────────────────────────────

  describe("round-trip consistency", () => {
    const langPairs = [
      { a: "fr", b: "en" },
      { a: "en", b: "pt" },
      { a: "pt", b: "fr" },
      { a: "de", b: "ja" },
    ];

    langPairs.forEach(({ a, b }) => {
      it(`${a}→${b}: side resolution is consistent`, () => {
        const sideA = { text: `text_${a}`, lang: a, label: getLangLabel(a) };
        const sideB = { text: `text_${b}`, lang: b, label: getLangLabel(b) };

        // en-pt (A first)
        const enPt = resolveStudySides(sideA, sideB, "en-pt");
        expect(enPt.promptSide.lang).toBe(a);
        expect(enPt.answerSide.lang).toBe(b);

        // pt-en (B first)
        const ptEn = resolveStudySides(sideA, sideB, "pt-en");
        expect(ptEn.promptSide.lang).toBe(b);
        expect(ptEn.answerSide.lang).toBe(a);

        // Both should reference the SAME texts, just in different order
        expect(enPt.promptSide.text).toBe(ptEn.answerSide.text);
        expect(enPt.answerSide.text).toBe(ptEn.promptSide.text);
      });
    });

    it("import preview → save → export → reimport: direction preserved", () => {
      // Simulate: user imports "Bonjour / Hello" into a fr→en list
      const importedTerm = "Bonjour";    // sideA = langA = Français
      const importedTranslation = "Hello"; // sideB = langB = English

      // After save, card in DB: term=Bonjour, translation=Hello
      const savedCard = { term: importedTerm, translation: importedTranslation };

      // Export format: term / translation
      const exportLine = `${savedCard.term} / ${savedCard.translation}`;
      expect(exportLine).toBe("Bonjour / Hello");

      // Reimport: parse export line
      const [reimportTerm, reimportTranslation] = exportLine.split(" / ");
      expect(reimportTerm).toBe(importedTerm);
      expect(reimportTranslation).toBe(importedTranslation);

      // Direction preserved end-to-end
      const sideA = { text: reimportTerm, lang: "fr", label: "Français" };
      const sideB = { text: reimportTranslation, lang: "en", label: "English" };
      const resolved = resolveStudySides(sideA, sideB, "en-pt");
      expect(resolved.promptSide.text).toBe("Bonjour");
      expect(resolved.promptSide.lang).toBe("fr");
      expect(resolved.answerSide.text).toBe("Hello");
      expect(resolved.answerSide.lang).toBe("en");
    });
  });
});
