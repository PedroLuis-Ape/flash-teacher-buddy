import { describe, expect, it } from "vitest";
import { buildCanonicalGlobalImportPrompt } from "../canonicalPrompt";
import {
  comparePackageWithManifest,
  configurationFromCanonicalPackage,
  stableConfigurationHash,
} from "../manifest";
import { parseGlobalImportText } from "../parser";
import {
  createOfficialGlobalImportExample,
  globalImportSchema,
} from "../schema/globalImportSchema";
import { clonePackage, makeCanonicalPackage, makeManifest, TEST_REQUEST_ID } from "./fixtures";

function promptBundle() {
  return buildCanonicalGlobalImportPrompt({
    mode: "from-file",
    packageName: "Pacote gerado",
    sourceLanguage: "en",
    targetLanguage: "pt-BR",
    level: "B1",
    theme: "Viagem",
    folders: [
      { name: "Aeroporto", lists: [{ name: "Check-in", cardCount: 2 }] },
      { name: "Hotel", lists: [{ name: "Recepção", cardCount: 3 }] },
    ],
    includeExamples: true,
    includeExplanations: true,
    allowRepetitions: false,
    requestId: TEST_REQUEST_ID,
  });
}

describe("compatibility prompt and manifest", () => {
  it("generates the previous canonical protocol and exact counts", () => {
    const bundle = promptBundle();
    const template = JSON.parse(bundle.template);
    expect(template.format).toBe("ape-global-import");
    expect(template.schema_version).toBe(1);
    expect(template.request_id).toBe(TEST_REQUEST_ID);
    expect(template.package.expected_folder_count).toBe(2);
    expect(template.package.expected_list_count).toBe(2);
    expect(template.package.expected_card_count).toBe(5);
    expect(bundle.prompt).toContain(`REQUEST_ID=${TEST_REQUEST_ID}`);
    expect(bundle.prompt).toContain("JSON_ONLY");
  });

  it("builds a manifest with a stable configuration hash", () => {
    const bundle = promptBundle();
    expect(bundle.manifest.request_id).toBe(TEST_REQUEST_ID);
    expect(bundle.manifest.status).toBe("generated");
    expect(bundle.manifest.configuration_hash).toBe(
      stableConfigurationHash(bundle.manifest.configuration),
    );
  });

  it("derives the displayed compatibility example from its schema", () => {
    const example = createOfficialGlobalImportExample(TEST_REQUEST_ID);
    expect(globalImportSchema.safeParse(example).success).toBe(true);
    expect(example.package.folders[0].lists[0].cards[0].type).toBe("normal");
  });

  it("keeps schema prompt and parser compatible after card arrays are filled", () => {
    const bundle = promptBundle();
    const template = JSON.parse(bundle.template);
    const exampleCard = createOfficialGlobalImportExample(TEST_REQUEST_ID)
      .package.folders[0].lists[0].cards[0];
    template.package.folders.forEach((folder: any) => {
      folder.lists.forEach((list: any) => {
        list.cards = Array.from({ length: list.expected_card_count }, (_, index) => ({
          ...exampleCard,
          term: `${list.title} ${index + 1}`,
          translation: `Tradução ${index + 1}`,
        }));
      });
    });
    const parsed = parseGlobalImportText(JSON.stringify(template));
    expect(globalImportSchema.safeParse(parsed.value).success).toBe(true);
  });

  it("accepts JSON wrapped by one outer Markdown fence", () => {
    const value = makeCanonicalPackage();
    const fenced = "```json\n" + JSON.stringify(value) + "\n```";
    const parsed = parseGlobalImportText(fenced);
    expect(parsed.extracted).toBe(true);
    expect(parsed.repaired).toBe(false);
  });

  it("rejects explanatory text around JSON", () => {
    const value = makeCanonicalPackage();
    expect(() => parseGlobalImportText("Texto antes\n" + JSON.stringify(value)))
      .toThrow(/JSON válido/i);
  });

  it("rejects trailing commas", () => {
    expect(() => parseGlobalImportText('{"a":1,}')).toThrow(/vírgula final/i);
  });

  it("detects names and order changed after prompt generation", () => {
    const original = makeCanonicalPackage();
    const manifest = makeManifest(original);
    const changed = clonePackage(original);
    changed.package.folders[0].title = "Nome alterado";
    changed.package.folders.reverse();
    const issues = comparePackageWithManifest(changed, manifest);
    expect(issues.some((issue) => issue.path.endsWith("title"))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith("order_index"))).toBe(true);
  });

  it("uses the same configuration projection for manifest comparisons", () => {
    const value = makeCanonicalPackage();
    const projected = configurationFromCanonicalPackage(value);
    expect(stableConfigurationHash(projected)).toBe(makeManifest(value).configuration_hash);
  });
});
