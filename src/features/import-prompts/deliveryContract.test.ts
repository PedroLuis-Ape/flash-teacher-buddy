import { describe, expect, it } from "vitest";
import { buildSimpleFlashcardPrompt } from "@/features/smart-import/simplePrompt";
import { buildSmartImportPrompt } from "@/features/smart-import/prompt";
import { buildUniversalGlobalImportPrompt } from "@/features/global-import/universalPrompt";
import { buildLayeredUniversalGlobalImportPrompt } from "@/features/global-import/layeredUniversalPrompt";
import { buildGlobalImportPresetPrompt } from "@/features/global-import/prompts/presets";
import { buildCanonicalGlobalImportPrompt } from "@/features/global-import/canonicalPrompt";
import { buildFolderGlossaryAiPrompt } from "@/features/study/lib/folderGlossaryPrompt";
import { buildGlossaryAiPrompt } from "@/features/global-import/glossaryAiExport";
import { buildAdvancedCsvPrompt } from "@/features/global-import/advancedCsvPrompt";

const requiredRules = [
  "Entregue prioritariamente um arquivo .json para download.",
  "Caso não seja possível gerar um arquivo, devolva somente o JSON puro no chat, sem Markdown, explicações ou cercas de código.",
];

describe("shared JSON delivery contract", () => {
  it.each([
    ["simple", () => buildSimpleFlashcardPrompt({ listName: "Lista", sideALabel: "A", sideBLabel: "B" })],
    ["smart", () => buildSmartImportPrompt({ outputFormat: "json" })],
    ["universal", buildUniversalGlobalImportPrompt],
    ["layered", buildLayeredUniversalGlobalImportPrompt],
    ["preset", () => buildGlobalImportPresetPrompt("complete")],
    ["canonical", () => buildCanonicalGlobalImportPrompt({ mode: "from-file", packageName: "Pacote", sourceLanguage: "en", targetLanguage: "pt-BR", theme: "Tema", folders: [{ name: "Pasta", lists: [{ name: "Lista", cardCount: 1 }] }] }).prompt],
    ["folder glossary", () => buildFolderGlossaryAiPrompt({ folderTitle: "Pasta", labelA: "A", labelB: "B" })],
    ["glossary", () => buildGlossaryAiPrompt([])],
    ["advanced JSON", () => buildAdvancedCsvPrompt({ packageName: "Pacote", sourceLanguage: "en", targetLanguage: "pt-BR", theme: "Tema", folders: [{ name: "Pasta", lists: [{ name: "Lista", cardCount: 1 }] }] })],
  ])("includes the file-first fallback rules in %s", (_name, builder) => {
    const prompt = builder();
    requiredRules.forEach((rule) => expect(prompt).toContain(rule));
  });

  it("keeps the advanced AI builder JSON-first while preserving CSV upload compatibility", () => {
    const prompt = buildAdvancedCsvPrompt({
      packageName: "Pacote",
      sourceLanguage: "en",
      targetLanguage: "pt-BR",
      theme: "Tema",
      folders: [{ name: "Pasta", lists: [{ name: "Lista", cardCount: 1 }] }],
    });
    expect(prompt).toContain("MODO AVANÇADO JSON-FIRST");
    expect(prompt).toContain("Gere o arquivo JSON agora");
    expect(prompt).toContain("CSV continua aceito apenas nos uploads operacionais explícitos");
    expect(prompt).not.toContain("Gere o CSV agora");
  });
});
