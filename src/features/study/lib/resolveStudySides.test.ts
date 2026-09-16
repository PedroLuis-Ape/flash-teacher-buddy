import { describe, it, expect } from "vitest";
import {
  resolveStudySides,
  getLangLabel,
  resolveEffectiveListSettings,
  normalizeDirection,
} from "./resolveStudySides";

describe("normalizeDirection", () => {
  it("maps legacy tokens to canonical", () => {
    expect(normalizeDirection("en-pt")).toBe("a-b");
    expect(normalizeDirection("pt-en")).toBe("b-a");
  });

  it("passes through canonical tokens", () => {
    expect(normalizeDirection("a-b")).toBe("a-b");
    expect(normalizeDirection("b-a")).toBe("b-a");
    expect(normalizeDirection("any")).toBe("any");
  });
});

describe("resolveStudySides", () => {
  const sideA = { text: "Bonjour", lang: "fr", label: "Français" };
  const sideB = { text: "Hello", lang: "en", label: "English" };

  it("a-b direction → sideA is prompt", () => {
    const { promptSide, answerSide, isAFirst } = resolveStudySides(sideA, sideB, "a-b");
    expect(isAFirst).toBe(true);
    expect(promptSide.text).toBe("Bonjour");
    expect(answerSide.text).toBe("Hello");
  });

  it("b-a direction → sideB is prompt", () => {
    const { promptSide, answerSide, isAFirst } = resolveStudySides(sideA, sideB, "b-a");
    expect(isAFirst).toBe(false);
    expect(promptSide.text).toBe("Hello");
    expect(answerSide.text).toBe("Bonjour");
  });

  it("any direction → deterministic per card", () => {
    const r1 = resolveStudySides(sideA, sideB, "any", "card-1");
    const r2 = resolveStudySides(sideA, sideB, "any", "card-1");
    expect(r1.isAFirst).toBe(r2.isAFirst);
  });

  it("accepts legacy en-pt/pt-en", () => {
    const enPt = resolveStudySides(sideA, sideB, "en-pt");
    expect(enPt.isAFirst).toBe(true);
    const ptEn = resolveStudySides(sideA, sideB, "pt-en");
    expect(ptEn.isAFirst).toBe(false);
  });
});

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

describe("resolveEffectiveListSettings", () => {
  it("uses list settings when explicitly overridden", () => {
    const list = { lang_a: "fr", lang_b: "en", labels_a: "Français", labels_b: "English" };
    const folder = { lang_a: "es", lang_b: "pt", labels_a: "Español", labels_b: "Português" };
    const result = resolveEffectiveListSettings(list, folder);

    expect(result.langA).toBe("fr");
    expect(result.langB).toBe("en");
    expect(result.labelsA).toBe("Français");
    expect(result.labelsB).toBe("English");
    expect(result.languageSettingsMode).toBe("legacy");
    expect(result.isListOverride).toBe(true);
  });

  it("keeps the legacy folder fallback for old bare-default en/pt rows", () => {
    const list = { lang_a: "en", lang_b: "pt" };
    const folder = { lang_a: "fr", lang_b: "en", labels_a: "Français", labels_b: "English" };
    const result = resolveEffectiveListSettings(list, folder);

    expect(result.langA).toBe("fr");
    expect(result.langB).toBe("en");
    expect(result.labelsA).toBe("Français");
    expect(result.labelsB).toBe("English");
    expect(result.languageSettingsMode).toBe("legacy");
    expect(result.isListOverride).toBe(false);
  });

  it("treats explicit en/pt as authoritative even when the folder is inverted", () => {
    const list = {
      language_settings_mode: "explicit",
      study_type: "language",
      lang_a: "en",
      lang_b: "pt-BR",
      labels_a: "English",
      labels_b: "Português",
      tts_enabled: true,
    };
    const folder = {
      study_type: "language",
      lang_a: "pt-BR",
      lang_b: "en",
      labels_a: "Português",
      labels_b: "English",
      tts_enabled: false,
    };
    const result = resolveEffectiveListSettings(list, folder);

    expect(result).toMatchObject({
      langA: "en",
      langB: "pt-BR",
      labelsA: "English",
      labelsB: "Português",
      ttsEnabled: true,
      languageSettingsMode: "explicit",
      isListOverride: true,
    });
  });

  it("uses the folder deliberately when mode is inherited", () => {
    const list = {
      language_settings_mode: "inherited",
      study_type: "language",
      lang_a: "en",
      lang_b: "pt",
      labels_a: "English",
      labels_b: "Português",
      tts_enabled: true,
    };
    const folder = {
      study_type: "general",
      lang_a: "fr",
      lang_b: "de",
      labels_a: "Pergunta",
      labels_b: "Resposta",
      tts_enabled: false,
    };
    const result = resolveEffectiveListSettings(list, folder);

    expect(result).toMatchObject({
      studyType: "general",
      langA: "fr",
      langB: "de",
      labelsA: "Pergunta",
      labelsB: "Resposta",
      ttsEnabled: false,
      languageSettingsMode: "inherited",
      isListOverride: false,
    });
  });

  it("unknown or missing mode is treated as legacy for backwards compatibility", () => {
    const folder = { lang_a: "de", lang_b: "ja", labels_a: "Deutsch", labels_b: "日本語" };
    const missing = resolveEffectiveListSettings({ lang_a: "en", lang_b: "pt" }, folder);
    const unknown = resolveEffectiveListSettings({ language_settings_mode: "future", lang_a: "en", lang_b: "pt" }, folder);

    expect(missing.languageSettingsMode).toBe("legacy");
    expect(unknown.languageSettingsMode).toBe("legacy");
    expect(missing.langA).toBe("de");
    expect(unknown.langA).toBe("de");
  });

  it("never lets a reinforcement list inherit contradictory folder labels", () => {
    const list = {
      system_kind: "reinforcement",
      language_settings_mode: "inherited",
      study_type: "language",
      lang_a: "en",
      lang_b: "pt",
      labels_a: "English",
      labels_b: "Português",
    };
    const folder = {
      study_type: "language",
      lang_a: "pt",
      lang_b: "en",
      labels_a: "Português",
      labels_b: "English",
    };
    const result = resolveEffectiveListSettings(list, folder);

    expect(result.langA).toBe("en");
    expect(result.langB).toBe("pt");
    expect(result.labelsA).toBe("English");
    expect(result.labelsB).toBe("Português");
    expect(result.languageSettingsMode).toBe("explicit");
    expect(result.isListOverride).toBe(true);
  });

  it("falls back to folder when legacy list has null langs", () => {
    const list = { lang_a: null, lang_b: null };
    const folder = { lang_a: "de", lang_b: "ja", labels_a: "Deutsch", labels_b: "日本語" };
    const result = resolveEffectiveListSettings(list, folder);

    expect(result.langA).toBe("de");
    expect(result.langB).toBe("ja");
    expect(result.languageSettingsMode).toBe("legacy");
    expect(result.isListOverride).toBe(false);
  });

  it("uses bare defaults when neither list nor folder have config", () => {
    const result = resolveEffectiveListSettings(null, null);
    expect(result.langA).toBe("en");
    expect(result.langB).toBe("pt");
    expect(result.labelsA).toBe("English");
    expect(result.labelsB).toBe("Português");
    expect(result.languageSettingsMode).toBe("legacy");
  });

  it("derives labels from getLangLabel when labels are missing", () => {
    const list = { language_settings_mode: "explicit", lang_a: "ko", lang_b: "ru" };
    const result = resolveEffectiveListSettings(list, null);
    expect(result.labelsA).toBe("한국어");
    expect(result.labelsB).toBe("Русский");
  });

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

        const ab = resolveStudySides(sideA, sideB, "a-b");
        expect(ab.promptSide.lang).toBe(a);
        expect(ab.answerSide.lang).toBe(b);

        const ba = resolveStudySides(sideA, sideB, "b-a");
        expect(ba.promptSide.lang).toBe(b);
        expect(ba.answerSide.lang).toBe(a);

        expect(ab.promptSide.text).toBe(ba.answerSide.text);
        expect(ab.answerSide.text).toBe(ba.promptSide.text);
      });
    });

    it("import preview → save → export → reimport: direction preserved", () => {
      const importedTerm = "Bonjour";
      const importedTranslation = "Hello";

      const savedCard = { term: importedTerm, translation: importedTranslation };
      const exportLine = `${savedCard.term} / ${savedCard.translation}`;
      expect(exportLine).toBe("Bonjour / Hello");

      const [reimportTerm, reimportTranslation] = exportLine.split(" / ");
      expect(reimportTerm).toBe(importedTerm);
      expect(reimportTranslation).toBe(importedTranslation);

      const sideA = { text: reimportTerm, lang: "fr", label: "Français" };
      const sideB = { text: reimportTranslation, lang: "en", label: "English" };
      const resolved = resolveStudySides(sideA, sideB, "a-b");
      expect(resolved.promptSide.text).toBe("Bonjour");
      expect(resolved.promptSide.lang).toBe("fr");
      expect(resolved.answerSide.text).toBe("Hello");
      expect(resolved.answerSide.lang).toBe("en");
    });
  });
});
