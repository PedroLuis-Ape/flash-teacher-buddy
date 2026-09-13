import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("autoria publica nao pode ser fabricada no cliente", () => {
  it("o fallback legado de listas nao injeta nome de autor sintetico", () => {
    const page = read("src/pages/PublicLearningListPage.tsx");
    expect(page).not.toContain('author_display_name: "Professor no APE"');
    expect(page).toContain("author_display_name: null");
  });

  it("nenhum builder de JSON-LD usa nome de autor como fallback fixo", () => {
    const builders = [
      "scripts/prerender-public-learning-resources.mjs",
      "scripts/prerender-public-learning-lists.mjs",
      "src/components/seo/publicLearningResourceStructuredData.ts",
      "src/components/seo/publicLearningListStructuredData.ts",
      "scripts/prerender-public-materials.mjs",
    ].map(read);
    for (const source of builders) {
      expect(source).not.toMatch(/name:\s*[^,\n]*\|\|\s*"Professor no APE"/);
    }
  });

  it("as camadas de dados nao fabricam nome de autor", () => {
    expect(read("scripts/public-learning-list-data.mjs")).toContain(": null,");
    expect(read("scripts/public-learning-resource-data.mjs")).toContain("authorName || null");
    for (const file of ["scripts/public-learning-list-data.mjs", "scripts/public-learning-resource-data.mjs"]) {
      expect(read(file)).not.toContain("Professor no APE");
    }
  });

  it("o rotulo de interface do RPC nao conta como autoria no JSON-LD", () => {
    const source = read("scripts/prerender-public-materials.mjs");
    expect(source).toContain("isPlaceholderAuthor");
    expect(source).toContain("realAuthorName");
  });
});
