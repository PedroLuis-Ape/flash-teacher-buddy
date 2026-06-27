import { describe, expect, it } from "vitest";
import { buildFolderGlossaryAiPrompt } from "./lib/folderGlossaryPrompt";

describe("official folder glossary contract", () => {
  it("includes the complete prompt", () => {
    const prompt = buildFolderGlossaryAiPrompt({ folderTitle: "Avançado", labelA: "English", labelB: "Português" });
    expect(prompt).toContain("# 22. DADOS QUE O USUÁRIO VAI FORNECER");
  });
});
