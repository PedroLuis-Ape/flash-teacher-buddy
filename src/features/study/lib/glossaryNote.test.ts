import { describe, expect, it } from "vitest";
import {
  applyGlossaryNote,
  buildGlossaryNoteTarget,
  GLOSSARY_NOTE_MAX_LENGTH,
  readGlossaryNote,
  sanitizeGlossaryNote,
} from "./glossaryNote";
import { mergeGlossaryAndManual } from "./glossaryMerge";
import type { WordHint } from "./wordHints";

const SENTENCE = "I went to the bank and the river bank was flooded.";
const FIRST_BANK = SENTENCE.indexOf("bank");
const SECOND_BANK = SENTENCE.lastIndexOf("bank");

const firstTarget = buildGlossaryNoteTarget(
  { text: "bank", startIndex: FIRST_BANK, endIndex: FIRST_BANK + 4, scope: "contextual" },
  "A",
  "banco",
);

const secondTarget = buildGlossaryNoteTarget(
  { text: "bank", startIndex: SECOND_BANK, endIndex: SECOND_BANK + 4, scope: "contextual" },
  "A",
  "margem",
);

describe("glossary note (anotação pessoal de uso)", () => {
  it("cria a anotação contextual sem tocar nas outras entradas", () => {
    const base: WordHint[] = [
      { text: "went", translation: "fui", startIndex: 2, endIndex: 6, side: "A" },
    ];
    const next = applyGlossaryNote(base, firstTarget, "Aqui significa banco financeiro.");

    expect(base).toHaveLength(1);
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual(base[0]);
    expect(next[1]).toMatchObject({
      text: "bank",
      translation: "banco",
      note: "Aqui significa banco financeiro.",
      side: "A",
      scope: "contextual",
      noteOnly: true,
    });
  });

  it("edita a anotação sem alterar a tradução existente", () => {
    const base: WordHint[] = [
      { text: "bank", translation: "banco", startIndex: FIRST_BANK, endIndex: FIRST_BANK + 4, side: "A" },
    ];
    const withNote = applyGlossaryNote(base, firstTarget, "primeira nota");
    const edited = applyGlossaryNote(withNote, firstTarget, "nota corrigida");

    expect(edited).toHaveLength(1);
    expect(edited[0].translation).toBe("banco");
    expect(edited[0].note).toBe("nota corrigida");
    expect(edited[0].noteOnly).toBeUndefined();
  });

  it("remove a camada que existia somente para hospedar a anotação", () => {
    const base: WordHint[] = [
      { text: "went", translation: "fui", startIndex: 2, endIndex: 6, side: "A" },
    ];
    const withNote = applyGlossaryNote(base, firstTarget, "nota temporária");
    const removed = applyGlossaryNote(withNote, firstTarget, "");

    expect(removed).toEqual(base);
  });

  it("esvazia a anotação sem apagar a tradução do card", () => {
    const base: WordHint[] = [
      { text: "bank", translation: "banco", note: "antiga", startIndex: FIRST_BANK, endIndex: FIRST_BANK + 4, side: "A" },
    ];
    const removed = applyGlossaryNote(base, firstTarget, "");

    expect(removed).toHaveLength(1);
    expect(removed[0].translation).toBe("banco");
    expect(removed[0].note).toBeUndefined();
  });

  it("é idempotente ao marcar e ao remover", () => {
    const base: WordHint[] = [];
    const once = applyGlossaryNote(base, firstTarget, "ratio = relação");
    const twice = applyGlossaryNote(once, firstTarget, "ratio = relação");
    expect(twice).toHaveLength(1);

    const cleared = applyGlossaryNote(twice, firstTarget, "");
    const clearedTwice = applyGlossaryNote(cleared, firstTarget, "");
    expect(clearedTwice).toHaveLength(0);
  });

  it("respeita o lado físico do card", () => {
    const base: WordHint[] = [
      { text: "bank", translation: "banco", startIndex: FIRST_BANK, endIndex: FIRST_BANK + 4, side: "A" },
    ];
    const targetSideB = { ...firstTarget, side: "B" as const };
    expect(applyGlossaryNote(base, targetSideB, "nota" )).toHaveLength(2);
    expect(readGlossaryNote(base, targetSideB)).toBe("");
  });

  it("distingue duas ocorrências da mesma palavra na mesma frase", () => {
    const base: WordHint[] = [];
    const withFirst = applyGlossaryNote(base, firstTarget, "banco financeiro");
    const withBoth = applyGlossaryNote(withFirst, secondTarget, "margem do rio");

    expect(withBoth).toHaveLength(2);
    expect(readGlossaryNote(withBoth, firstTarget)).toBe("banco financeiro");
    expect(readGlossaryNote(withBoth, secondTarget)).toBe("margem do rio");

    const removedFirst = applyGlossaryNote(withBoth, firstTarget, "");
    expect(removedFirst).toHaveLength(1);
    expect(readGlossaryNote(removedFirst, secondTarget)).toBe("margem do rio");
  });

  it("não altera o lado B quando a anotação é do lado A", () => {
    const base: WordHint[] = [
      { text: "banco", translation: "bank", side: "B", note: "nota do B" },
    ];
    const next = applyGlossaryNote(base, { ...firstTarget, text: "banco", translation: "banco" }, "nova nota");
    expect(base[0].note).toBe("nota do B");
    expect(readGlossaryNote(next, { ...firstTarget, text: "banco", translation: "banco" })).toBe("nova nota");
  });

  it("mantém glossário global e nota contextual como camadas separadas", () => {
    const manual: WordHint[] = applyGlossaryNote(
      [],
      secondTarget,
      "Aqui é margem, não instituição financeira.",
    );
    const merged = mergeGlossaryAndManual(
      SENTENCE,
      "A",
      [{ original_text: "bank", translated_text: "banco", side: "A", is_active: true }],
      manual,
    );

    const contextual = merged.find((hint) => hint.scope === "contextual");
    const global = merged.find((hint) => hint.scope !== "contextual");
    expect(contextual?.translations.some((translation) => translation.note?.includes("margem"))).toBe(true);
    expect(global?.translations.some((translation) => translation.text === "banco")).toBe(true);
  });

  it("normaliza e limita o texto da anotação", () => {
    expect(sanitizeGlossaryNote("  linha 1\r\nlinha 2  ")).toBe("linha 1\nlinha 2");
    expect(sanitizeGlossaryNote("x".repeat(GLOSSARY_NOTE_MAX_LENGTH + 50))).toHaveLength(GLOSSARY_NOTE_MAX_LENGTH);
  });
});

