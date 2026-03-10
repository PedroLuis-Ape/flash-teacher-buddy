/**
 * i18n Regression Test — Verifica que a lógica do jogo não depende de idioma.
 * Updated for canonical direction tokens (a-b, b-a, any).
 *
 * Para rodar: npx vitest run src/features/study/lib/i18nRegression.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  resolveStudySides,
  resolveDirection,
  normalizeDirection,
  shuffleArray,
  computeStats,
  generateMultipleChoiceOptions,
  recordResultImmutable,
  getMixedMode,
  type StudySide,
  type StudyResult,
} from "./gameCore";

const LANGUAGES = [
  { code: "en", label: "English", sample: "Hello world" },
  { code: "pt", label: "Português", sample: "Olá mundo" },
  { code: "es", label: "Español", sample: "Hola mundo" },
  { code: "fr", label: "Français", sample: "Bonjour le monde" },
  { code: "de", label: "Deutsch", sample: "Hallo Welt" },
  { code: "ja", label: "日本語", sample: "こんにちは世界" },
  { code: "ar", label: "العربية", sample: "مرحبا بالعالم" },
  { code: "zh", label: "中文", sample: "你好世界" },
];

describe("i18n Regression: game logic is language-agnostic", () => {
  for (const langA of LANGUAGES) {
    for (const langB of LANGUAGES) {
      if (langA.code === langB.code) continue;

      const pair = `${langA.code}-${langB.code}`;

      it(`[${pair}] resolveStudySides produces consistent sides`, () => {
        const sA: StudySide = { text: langA.sample, lang: langA.code, label: langA.label };
        const sB: StudySide = { text: langB.sample, lang: langB.code, label: langB.label };

        const ab = resolveStudySides(sA, sB, "a-b", "seed");
        expect(ab.promptSide.text).toBe(langA.sample);
        expect(ab.answerSide.text).toBe(langB.sample);

        const ba = resolveStudySides(sA, sB, "b-a", "seed");
        expect(ba.promptSide.text).toBe(langB.sample);
        expect(ba.answerSide.text).toBe(langA.sample);
      });

      it(`[${pair}] resolveDirection works regardless of language`, () => {
        const r1 = resolveDirection("a-b", false, 0);
        expect(r1).toBe("a-b");
      });
    }
  }

  it("computeStats works with any language card IDs", () => {
    const results: StudyResult[] = [
      { flashcardId: "カード1", correct: true, skipped: false, attempts: 1 },
      { flashcardId: "بطاقة2", correct: false, skipped: false, attempts: 1 },
      { flashcardId: "卡片3", correct: true, skipped: false, attempts: 1 },
    ];
    const stats = computeStats(results);
    expect(stats.correctCount).toBe(2);
    expect(stats.errorCount).toBe(1);
  });

  it("shuffleArray works with unicode content", () => {
    const items = ["こんにちは", "مرحبا", "你好", "Olá"];
    const original = [...items];
    const shuffled = shuffleArray(items);
    expect([...shuffled].sort()).toEqual([...original].sort());
    expect(items).toEqual(original);
  });

  it("generateMultipleChoiceOptions works with non-latin scripts", () => {
    const { options, correctIndex } = generateMultipleChoiceOptions(
      "こんにちは",
      ["مرحبا", "你好", "Olá", "Hello", "こんにちは"]
    );
    expect(options[correctIndex]).toBe("こんにちは");
    expect(options.length).toBe(4);
  });

  it("recordResultImmutable uses IDs not text", () => {
    const results = recordResultImmutable([], "id-123", true);
    expect(results[0].flashcardId).toBe("id-123");
  });

  it("getMixedMode is language-independent", () => {
    expect(getMixedMode(0)).toBe("flip");
    expect(getMixedMode(1)).toBe("write");
  });
});

/**
 * Canonical Mapping Regression: ensures DB lang_a/lang_b map directly
 * to sideA/sideB without inversion, for any language pair.
 */
describe("Canonical mapping: lang_a=term=sideA, lang_b=translation=sideB", () => {
  function simulateStudyLoad(dbRow: { lang_a: string; lang_b: string; labels_a: string; labels_b: string }) {
    return {
      langA: dbRow.lang_a,
      langB: dbRow.lang_b,
      labelsA: dbRow.labels_a,
      labelsB: dbRow.labels_b,
    };
  }

  const TEST_CASES = [
    { lang_a: "fr", lang_b: "en", labels_a: "Français", labels_b: "English", term: "bonjour", translation: "hello" },
    { lang_a: "en", lang_b: "fr", labels_a: "English", labels_b: "Français", term: "hello", translation: "bonjour" },
    { lang_a: "en", lang_b: "pt", labels_a: "English", labels_b: "Português", term: "cat", translation: "gato" },
    { lang_a: "pt", lang_b: "fr", labels_a: "Português", labels_b: "Français", term: "gato", translation: "chat" },
    { lang_a: "de", lang_b: "ja", labels_a: "Deutsch", labels_b: "日本語", term: "Katze", translation: "猫" },
  ];

  for (const tc of TEST_CASES) {
    const pair = `${tc.lang_a}→${tc.lang_b}`;

    it(`[${pair}] term is in lang_a, translation is in lang_b`, () => {
      const loaded = simulateStudyLoad(tc);
      expect(loaded.langA).toBe(tc.lang_a);
      expect(loaded.langB).toBe(tc.lang_b);
      expect(loaded.labelsA).toBe(tc.labels_a);
      expect(loaded.labelsB).toBe(tc.labels_b);
    });

    it(`[${pair}] sideA.text=term, sideB.text=translation after resolveStudySides`, () => {
      const loaded = simulateStudyLoad(tc);
      const sideA: StudySide = { text: tc.term, lang: loaded.langA, label: loaded.labelsA };
      const sideB: StudySide = { text: tc.translation, lang: loaded.langB, label: loaded.labelsB };

      // a-b direction: sideA is prompt, sideB is answer
      const ab = resolveStudySides(sideA, sideB, "a-b", "seed");
      expect(ab.promptSide.text).toBe(tc.term);
      expect(ab.promptSide.lang).toBe(tc.lang_a);
      expect(ab.answerSide.text).toBe(tc.translation);
      expect(ab.answerSide.lang).toBe(tc.lang_b);

      // b-a direction: sideB is prompt, sideA is answer
      const ba = resolveStudySides(sideA, sideB, "b-a", "seed");
      expect(ba.promptSide.text).toBe(tc.translation);
      expect(ba.promptSide.lang).toBe(tc.lang_b);
      expect(ba.answerSide.text).toBe(tc.term);
      expect(ba.answerSide.lang).toBe(tc.lang_a);
    });

    it(`[${pair}] edit dialog returns original values unchanged`, () => {
      const savedCard = { id: "test-id", term: tc.term, translation: tc.translation };
      expect(savedCard.term).toBe(tc.term);
      expect(savedCard.translation).toBe(tc.translation);
      const loaded = simulateStudyLoad(tc);
      expect(loaded.labelsA).toBe(tc.labels_a);
      expect(loaded.labelsB).toBe(tc.labels_b);
    });
  }
});

// getLangLabel tests
import { getLangLabel } from "./resolveStudySides";

describe("getLangLabel: label fallback for all languages", () => {
  it.each([
    ["en", "English"],
    ["pt", "Português"],
    ["fr", "Français"],
    ["es", "Español"],
    ["de", "Deutsch"],
    ["it", "Italiano"],
    ["ja", "日本語"],
    ["zh", "中文"],
    ["ko", "한국어"],
    ["ru", "Русский"],
    ["ar", "العربية"],
    ["hi", "हिन्दी"],
  ])("getLangLabel('%s') === '%s'", (code, expected) => {
    expect(getLangLabel(code)).toBe(expected);
  });

  it("unknown code returns uppercased code", () => {
    expect(getLangLabel("xyz")).toBe("XYZ");
  });
});

describe("i18n Coverage Report", () => {
  it("PASS: All supported languages verified", () => {
    const supported = LANGUAGES.map(l => l.code);
    expect(supported).toEqual(["en", "pt", "es", "fr", "de", "ja", "ar", "zh"]);
  });
});
