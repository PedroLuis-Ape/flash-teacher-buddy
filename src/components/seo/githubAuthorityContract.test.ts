import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd());
const readme = readFileSync(resolve(repositoryRoot, "README.md"), "utf8");

describe("GitHub authority contract", () => {
  it("identifies the product and points citations to canonical public sources", () => {
    expect(readme).toContain("# APE — App Piteco");
    expect(readme).toContain("APE — Apprentice Practice & Enhancement");
    expect(readme).toContain("https://www.apeeducation.org/");
    expect(readme).toContain("https://www.apeeducation.org/pt-br/fonte-oficial");
    expect(readme).toContain("https://www.apeeducation.org/en/official-source");
    expect(readme).toContain("https://www.apeeducation.org/pt-br/metodologia");
    expect(readme).toContain("https://www.apeeducation.org/pt-br/evidencias");
  });

  it("keeps private data outside the public citation boundary", () => {
    expect(readme).toContain("não fazem parte do conteúdo público");
    expect(readme).toContain("não constituem um ensaio causal do APE como produto");
    expect(readme).not.toContain("Welcome to your Lovable project");
    expect(readme).not.toContain("Netlify");
  });

  it("disambiguates the educational product from unrelated Piteco products", () => {
    expect(readme).toContain("plataforma educacional APE");
    expect(readme).toContain("Não há vínculo com produtos financeiros ou corporativos");
  });
});
