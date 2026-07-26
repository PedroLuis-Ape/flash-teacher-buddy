import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) =>
  readFileSync(join(root, path), "utf8").replace(/\r\n?/g, "\n");

const mixedStudy = read("src/pages/MixedStudy.tsx");
const resolver = read("src/features/study/hooks/useResolvedStudyGlossaryHints.ts");
const writeView = read("src/features/study/components/WriteStudyView.tsx");
const multipleChoiceView = read("src/features/study/components/MultipleChoiceStudyView.tsx");
const unscrambleView = read("src/features/study/components/UnscrambleStudyView.tsx");
const runtime = read("src/features/study/lib/listGlossaryRuntime.ts");
const coverage = read("src/features/study/lib/folderGlossaryCoverage.ts");

describe("folder glossary consistency across audit and games", () => {
  it("keeps the audit word-by-word across both sides and every loaded card", () => {
    expect(coverage).toContain("for (const token of tokenMatches(text))");
    expect(coverage).toContain('processText(card, "A", card.term)');
    expect(coverage).toContain('processText(card, "B", card.translation)');
    expect(coverage).toContain("await loadFolderCards(lists.map((list) => list.id))");
  });

  it("adds a folder-glossary safety net to every activity used by MixedStudy", () => {
    expect(mixedStudy).toContain("<WriteStudyView");
    expect(mixedStudy).toContain("<MultipleChoiceStudyView");
    expect(mixedStudy).toContain("<UnscrambleStudyView");
    expect(mixedStudy).toContain("wordHintsA: currentCard.word_hints");

    for (const source of [writeView, multipleChoiceView, unscrambleView]) {
      expect(source).toContain("useResolvedStudyGlossaryHints");
      expect(source).toContain("mergedHintsA={glossaryHints.mergedHintsA}");
      expect(source).toContain("mergedHintsB={glossaryHints.mergedHintsB}");
      expect(source).toContain("Carregando glossário da pasta");
    }
  });

  it("resolves missing hints from the current private or portal list", () => {
    expect(resolver).toContain("useListGlossary(listId)");
    expect(resolver).toContain("(?:portal\\/)?list");
    expect(resolver).toContain('input.front,\n      "A"');
    expect(resolver).toContain('input.back,\n      "B"');
    expect(resolver).toContain("input.mergedHintsA ?? computedA");
    expect(resolver).toContain("input.mergedHintsB ?? computedB");
  });

  it("does not accept a partially loaded glossary as complete", () => {
    expect(runtime).toContain('rpc("get_folder_glossary_summary_v2"');
    expect(runtime).toContain("active_count");
    expect(runtime).toContain("hasCompleteCount");
    expect(runtime).toContain("describeIncomplete");
    expect(runtime).toContain("não pôde ser carregado por inteiro");
  });
});
