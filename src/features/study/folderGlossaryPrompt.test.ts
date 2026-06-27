import { describe, expect, it } from "vitest";
import { buildFolderGlossaryAiPrompt } from "./lib/folderGlossaryPrompt";

describe("folder glossary AI prompt", () => {
  it("describes the canonical JSON contract and the current folder sides", () => {
    const prompt = buildFolderGlossaryAiPrompt({
      folderTitle: "Verbo To Be",
      labelA: "Inglês",
      labelB: "Português",
    });

    expect(prompt).toContain('"app-piteco-folder-glossary"');
    expect(prompt).toContain('"1.0"');
    expect(prompt).toContain("Verbo To Be");
    expect(prompt).toContain('Lado A: "Inglês"');
    expect(prompt).toContain('Lado B: "Português"');
    expect(prompt).toContain("JSON puro e válido");
    expect(prompt).toContain("Não repita o mesmo term");
    expect(prompt).toContain("entries");
  });

  it("uses safe labels when folder metadata is blank", () => {
    const prompt = buildFolderGlossaryAiPrompt({
      folderTitle: " ",
      labelA: "",
      labelB: " ",
    });

    expect(prompt).toContain("Pasta sem nome");
    expect(prompt).toContain('Lado A: "Lado A"');
    expect(prompt).toContain('Lado B: "Lado B"');
  });
});
