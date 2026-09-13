import { create, act, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import React, { useEffect } from "react";
import { readFileSync } from "node:fs";
import { resolveStudySides } from "./resolveStudySides";
import { getLangLabel, toBCP47 } from "./languages";
import { useTTS } from "../hooks/useTTS";
import { classifyLanguageText } from "@/lib/languageClassifier";
import { resolveDeckOrientation, resolveEffectiveSideLabels } from "./resolveDeckOrientation";

interface CardFixture {
  id: string;
  term: string;
  translation: string;
}

const makeStrongEnglish = (index: number) => `The teacher is with the class ${index}`;
const makeStrongPortuguese = (index: number) => `Eu estou com a turma e você não ${index}`;

const makeDeck = (orientation: "normal" | "inverted", count = 8): CardFixture[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `card-${index}`,
    term: orientation === "normal" ? makeStrongEnglish(index) : makeStrongPortuguese(index),
    translation: orientation === "normal" ? makeStrongPortuguese(index) : makeStrongEnglish(index),
  }));

describe("resolveDeckOrientation", () => {
  it("preserves the audit classifier's score and confidence thresholds", () => {
    expect(classifyLanguageText("The teacher is with the class")).toMatchObject({
      lang: "en",
      score: 11,
      confidence: "high",
    });
    expect(classifyLanguageText("Eu estou com a turma e você não")).toMatchObject({
      lang: "pt",
      score: 11,
      confidence: "high",
    });
    expect(classifyLanguageText("1234")).toBeNull();
    expect(classifyLanguageText("OK.")).toBeNull();
  });

  it("keeps a normal deck and exposes the effective prompt language for a-b", () => {
    const card = { id: "teacher", term: "I am a teacher", translation: "Eu sou professor" };
    const orientation = resolveDeckOrientation({ langA: "en", langB: "pt", cards: [card] });
    const sides = resolveStudySides(
      { text: card.term, lang: orientation.langA, label: getLangLabel(orientation.langA) },
      { text: card.translation, lang: orientation.langB, label: getLangLabel(orientation.langB) },
      "a-b",
      card.id,
    );

    expect(orientation.inverted).toBe(false);
    expect(sides.promptSide).toMatchObject({ text: "I am a teacher", lang: "en", label: "English" });
    expect(sides.answerSide).toMatchObject({ text: "Eu sou professor", lang: "pt", label: "Português" });
    expect(toBCP47(sides.promptSide.lang)).toMatch(/^en-/);
  });

  it("keeps the answer-side text, label and TTS locale coherent for b-a", () => {
    const card = { id: "teacher", term: "I am a teacher", translation: "Eu sou professor" };
    const sides = resolveStudySides(
      { text: card.term, lang: "en", label: "English" },
      { text: card.translation, lang: "pt", label: "Português" },
      "b-a",
      card.id,
    );

    expect(sides.promptSide).toMatchObject({ text: "Eu sou professor", lang: "pt", label: "Português" });
    expect(sides.answerSide).toMatchObject({ text: "I am a teacher", lang: "en", label: "English" });
    expect(toBCP47(sides.promptSide.lang)).toBe("pt-BR");
  });

  it("keeps text, label, language and locale aligned whichever side any chooses", () => {
    const card = { id: "any-card", term: "I am a teacher", translation: "Eu sou professor" };
    const sides = resolveStudySides(
      { text: card.term, lang: "en", label: "English" },
      { text: card.translation, lang: "pt", label: "Português" },
      "any",
      card.id,
    );

    expect(sides.promptSide.label).toBe(getLangLabel(sides.promptSide.lang));
    expect(sides.answerSide.label).toBe(getLangLabel(sides.answerSide.lang));
    expect(sides.promptSide.text).toBe(sides.promptSide.lang === "en" ? card.term : card.translation);
    expect(sides.answerSide.text).toBe(sides.answerSide.lang === "en" ? card.term : card.translation);
    expect(toBCP47(sides.promptSide.lang)).toMatch(/^(en-US|pt-BR)$/);
  });

  it("recognizes legacy metadata inverted only with strong aggregate evidence", () => {
    const orientation = resolveDeckOrientation({ langA: "en", langB: "pt", cards: makeDeck("inverted") });
    const labels = resolveEffectiveSideLabels({
      labelA: "English",
      labelB: "Português",
      inverted: orientation.inverted,
    });
    const sides = resolveStudySides(
      { text: makeStrongPortuguese(0), lang: orientation.langA, label: labels.labelA },
      { text: makeStrongEnglish(0), lang: orientation.langB, label: labels.labelB },
      "a-b",
      "legacy-card",
    );

    expect(orientation).toMatchObject({ langA: "pt", langB: "en", inverted: true });
    expect(orientation.evidence.classifiedCards).toBe(8);
    expect(orientation.evidence.invertedCards).toBe(8);
    expect(orientation.evidence.inversionRatio).toBe(1);
    expect(sides.promptSide).toMatchObject({ lang: "pt", label: "Português" });
    expect(sides.answerSide).toMatchObject({ lang: "en", label: "English" });
    expect(toBCP47(sides.promptSide.lang)).toBe("pt-BR");
  });

  it("never inverts a mass of short or ambiguous phrases", () => {
    const cards = Array.from({ length: 20 }, (_, index) => ({
      id: `ambiguous-${index}`,
      term: ["No.", "OK.", "Hotel.", "Pizza."][index % 4],
      translation: ["No.", "OK.", "Hotel.", "Pizza."][(index + 1) % 4],
    }));
    const orientation = resolveDeckOrientation({ langA: "en", langB: "pt", cards });

    expect(orientation.inverted).toBe(false);
    expect(orientation.evidence.classifiedCards).toBe(0);
  });

  it("never inverts an otherwise strong deck from only one or two cards", () => {
    const orientation = resolveDeckOrientation({ langA: "en", langB: "pt", cards: makeDeck("inverted", 2) });

    expect(orientation.inverted).toBe(false);
    expect(orientation.evidence.classifiedCards).toBe(2);
    expect(orientation.evidence.minimumClassifiedCards).toBe(8);
  });
});

describe("MixedStudy language settings contract", () => {
  const mixedSource = readFileSync(new URL("../../../pages/MixedStudy.tsx", import.meta.url), "utf8");

  it("uses the centralized list settings resolver and carries TTS metadata", () => {
    expect(mixedSource).toContain('resolveEffectiveListSettings(listRow, folderRow)');
    expect(mixedSource).toContain("tts_enabled");
    expect(mixedSource).toContain("system_kind");
    expect(mixedSource).not.toContain("listRow?.lang_a || folderRow?.lang_a || \"en\"");
  });

  it("keeps system collections on their own language metadata", async () => {
    const { resolveEffectiveListSettings } = await import("./resolveStudySides");
    const result = resolveEffectiveListSettings(
      {
        system_kind: "reinforcement",
        lang_a: "en",
        lang_b: "pt",
        labels_a: null,
        labels_b: null,
        tts_enabled: true,
      },
      {
        lang_a: "pt",
        lang_b: "en",
        labels_a: "Português",
        labels_b: "English",
        tts_enabled: false,
      },
    );

    expect(result).toMatchObject({
      langA: "en",
      langB: "pt",
      labelsA: "English",
      labelsB: "Português",
      ttsEnabled: true,
    });
  });
});

interface SpeechCall {
  text: string;
  lang: string;
  onstart?: () => void;
  onend?: () => void;
  onerror?: (event: { error: string }) => void;
}

function SpeechHarness({ text, lang }: { text: string; lang: string }) {
  const { speak } = useTTS();
  useEffect(() => {
    void speak(text, { langOverride: lang, startTimeoutMs: 100 });
  }, [lang, speak, text]);
  return null;
}

describe("useTTS study-side locale contract", () => {
  let speechCalls: SpeechCall[];
  let renderer: ReactTestRenderer | null;

  beforeEach(() => {
    speechCalls = [];
    renderer = null;
    const speechSynthesis = {
      speaking: false,
      pending: false,
      getVoices: () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      cancel: vi.fn(),
      speak: (utterance: SpeechCall) => {
        speechCalls.push(utterance);
        queueMicrotask(() => {
          utterance.onstart?.();
          utterance.onend?.();
        });
      },
    };
    const windowMock = {
      speechSynthesis,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("window", windowMock);
    vi.stubGlobal("document", { visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("SpeechSynthesisUtterance", class {
      text: string;
      lang = "";
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      pitch = 1;
      volume = 1;
      onstart?: () => void;
      onend?: () => void;
      onerror?: (event: { error: string }) => void;
      constructor(text: string) {
        this.text = text;
      }
    });
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    vi.unstubAllGlobals();
  });

  it("speaks English text with an English locale and Portuguese text with pt-BR", async () => {
    await act(async () => {
      renderer = create(React.createElement(SpeechHarness, { text: "I am a teacher", lang: toBCP47("en") }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(speechCalls[0]).toMatchObject({ text: "I am a teacher", lang: "en-US" });

    act(() => renderer?.unmount());
    speechCalls = [];
    await act(async () => {
      renderer = create(React.createElement(SpeechHarness, { text: "Eu sou professor", lang: toBCP47("pt") }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(speechCalls[0]).toMatchObject({ text: "Eu sou professor", lang: "pt-BR" });
  });
});
