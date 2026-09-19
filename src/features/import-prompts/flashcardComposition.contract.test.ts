import { describe, expect, it } from "vitest";
import {
  FLASHCARD_COMPOSITION_MARKERS,
  FLASHCARD_COMPOSITION_RULES,
} from "./flashcardCompositionContract";
import { buildSmartImportPrompt } from "@/features/smart-import/prompt";
import { buildSimpleFlashcardPrompt } from "@/features/smart-import/simplePrompt";
import { buildUniversalGlobalImportPrompt } from "@/features/global-import/universalPrompt";
import { buildCanonicalGlobalImportPrompt } from "@/features/global-import/canonicalPrompt";
import { buildLayeredUniversalGlobalImportPrompt } from "@/features/global-import/layeredUniversalPrompt";
import { buildGlobalImportPresetPrompt } from "@/features/global-import/prompts/presets";
import { buildFinalGlobalImportPrompt } from "@/features/global-import/prompts/finalPrompt";
import { buildOwnerFinalImportPrompt } from "@/features/global-import/prompts/ownerFinalPrompt";

const personalContext = {
  scope: "personal" as const,
  intent: "structured" as const,
};

const classroomContext = {
  scope: "classroom" as const,
  intent: "structured" as const,
};

const canonical = () => buildCanonicalGlobalImportPrompt({
  mode: "from-file",
  packageName: "Pacote",
  sourceLanguage: "en",
  targetLanguage: "pt-BR",
  theme: "Tema",
  folders: [{ name: "Pasta", lists: [{ name: "Lista", cardCount: 1 }] }],
}).prompt;

const officialBuilders: Array<[string, () => string]> = [
  ["smart", () => buildSmartImportPrompt({ outputFormat: "json" })],
  ["smart-batch", () => buildSmartImportPrompt({ outputFormat: "json", includeLayeredCards: true })],
  ["simple", () => buildSimpleFlashcardPrompt({ listName: "Lista", sideALabel: "Lado A", sideBLabel: "Lado B" })],
  ["universal", buildUniversalGlobalImportPrompt],
  ["layered", buildLayeredUniversalGlobalImportPrompt],
  ["canonical", canonical],
  ["preset-batch", () => buildGlobalImportPresetPrompt("batch", personalContext)],
  ["preset-detailed", () => buildGlobalImportPresetPrompt("detailed", personalContext)],
  ["preset-complete", () => buildGlobalImportPresetPrompt("complete", personalContext)],
  ["final-complete", () => buildFinalGlobalImportPrompt("complete", personalContext)],
  ["owner-complete", () => buildOwnerFinalImportPrompt("complete", classroomContext)],
];

describe("flashcard composition contract", () => {
  it("has a single canonical source with the required pedagogical rules", () => {
    for (const marker of FLASHCARD_COMPOSITION_MARKERS) {
      expect(FLASHCARD_COMPOSITION_RULES).toContain(marker);
    }
    expect(FLASHCARD_COMPOSITION_RULES).toContain("2 ou 3");
    expect(FLASHCARD_COMPOSITION_RULES).toContain("parágrafo");
    expect(FLASHCARD_COMPOSITION_RULES).toContain("tradução palavra por palavra");
    expect(FLASHCARD_COMPOSITION_RULES).toContain("dentro das capacidades do formato atual");
  });

  it.each(officialBuilders)("%s prompt carries the canonical rules", (_name, build) => {
    const prompt = build();
    for (const marker of FLASHCARD_COMPOSITION_MARKERS) {
      expect(prompt).toContain(marker);
    }
    expect(prompt).toContain("2 ou 3");
    expect(prompt).toContain("parágrafo");
  });

  it.each(officialBuilders)("%s prompt does not duplicate the contract", (_name, build) => {
    const prompt = build();
    const occurrences = prompt.split(FLASHCARD_COMPOSITION_MARKERS[0]).length - 1;
    expect(occurrences).toBe(1);
  });

  it("keeps legacy 1.0 restricted to its own schema capabilities", () => {
    const prompt = buildUniversalGlobalImportPrompt();
    expect(prompt).toContain("Não crie glossário, camadas, dicas");
  });

  it("keeps layered mode free to use layers", () => {
    const prompt = buildLayeredUniversalGlobalImportPrompt();
    expect(prompt).toContain("cards layered");
    expect(prompt).not.toContain("Nunca gere cards layered. Gere interpretações úteis como cards normais separados.");
  });

  it("keeps user-provided content from being rewritten by the density rule", () => {
    for (const [, build] of officialBuilders) {
      expect(build()).toContain("NÃO reescreva o conteúdo");
    }
  });
});
