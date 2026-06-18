import { describe, expect, it } from "vitest";
import { parseGlobalImportText } from "../parser";
import { validateGlobalImportInput } from "../validation";
import { clonePackage, makeCanonicalPackage, makeManifest } from "./fixtures";

function codes(value: ReturnType<typeof validateGlobalImportInput>): string[] {
  return value.issues.map((issue) => issue.code);
}

function paths(value: ReturnType<typeof validateGlobalImportInput>): string[] {
  return value.issues.map((issue) => issue.path);
}

describe("canonical global import validation", () => {
  it("accepts a valid package with its manifest", () => {
    const value = makeCanonicalPackage();
    const result = validateGlobalImportInput(value, makeManifest(value));
    expect(result.valid).toBe(true);
    expect(result.sourceFormat).toBe("canonical");
    expect(result.summary).toEqual({ folders: 2, lists: 4, cards: 12 });
  });

  it("detects a cut JSON response", () => {
    expect(() => parseGlobalImportText('{"format":"ape-global-import","package":{')).toThrow(/cortado/i);
  });

  it("rejects an incompatible schema version", () => {
    const value = clonePackage(makeCanonicalPackage());
    value.schema_version = 2;
    const result = validateGlobalImportInput(value, null);
    expect(result.valid).toBe(false);
    expect(paths(result)).toContain("schema_version");
  });

  it("rejects a request id different from the manifest", () => {
    const original = makeCanonicalPackage();
    const value = clonePackage(original);
    value.request_id = "22222222-2222-4222-8222-222222222222";
    const result = validateGlobalImportInput(value, makeManifest(original));
    expect(result.valid).toBe(false);
    expect(codes(result)).toContain("manifest.request_id");
  });

  it("requires a local manifest for canonical packages", () => {
    const value = makeCanonicalPackage();
    const result = validateGlobalImportInput(value, null);
    expect(result.valid).toBe(false);
    expect(codes(result)).toContain("manifest.missing");
  });

  it("detects a missing folder", () => {
    const original = makeCanonicalPackage();
    const value = clonePackage(original);
    value.package.folders.pop();
    const result = validateGlobalImportInput(value, makeManifest(original));
    expect(result.valid).toBe(false);
    expect(paths(result).some((path) => path.includes("expected_folder_count"))).toBe(true);
  });

  it("detects an additional folder", () => {
    const original = makeCanonicalPackage();
    const value = clonePackage(original);
    const extra = clonePackage(original).package.folders[0];
    extra.title = "Pasta extra";
    extra.order_index = value.package.folders.length;
    value.package.folders.push(extra);
    expect(validateGlobalImportInput(value, makeManifest(original)).valid).toBe(false);
  });

  it("detects a missing list", () => {
    const original = makeCanonicalPackage();
    const value = clonePackage(original);
    value.package.folders[0].lists.pop();
    const result = validateGlobalImportInput(value, makeManifest(original));
    expect(result.valid).toBe(false);
    expect(paths(result).some((path) => path.includes("expected_list_count"))).toBe(true);
  });

  it("detects an additional list", () => {
    const original = makeCanonicalPackage();
    const value = clonePackage(original);
    const extra = clonePackage(original).package.folders[0].lists[0];
    extra.title = "Lista extra";
    extra.order_index = value.package.folders[0].lists.length;
    value.package.folders[0].lists.push(extra);
    expect(validateGlobalImportInput(value, makeManifest(original)).valid).toBe(false);
  });

  it("detects cards below the declared count", () => {
    const original = makeCanonicalPackage();
    const value = clonePackage(original);
    value.package.folders[0].lists[0].cards.pop();
    const result = validateGlobalImportInput(value, makeManifest(original));
    expect(result.valid).toBe(false);
    expect(paths(result).some((path) => path.includes("expected_card_count"))).toBe(true);
  });

  it("detects cards above the declared count", () => {
    const original = makeCanonicalPackage();
    const value = clonePackage(original);
    value.package.folders[0].lists[0].cards.push({
      ...value.package.folders[0].lists[0].cards[0],
      term: "Termo adicional",
      translation: "Tradução adicional",
    });
    expect(validateGlobalImportInput(value, makeManifest(original)).valid).toBe(false);
  });

  it("reports duplicate cards inside a list", () => {
    const value = makeCanonicalPackage();
    const mutable = clonePackage(value);
    mutable.package.folders[0].lists[0].cards[1] = clonePackage(value).package.folders[0].lists[0].cards[0];
    const result = validateGlobalImportInput(mutable, makeManifest(value));
    expect(result.issues.some((issue) => issue.code === "duplicate.card")).toBe(true);
  });

  it("rejects an empty required field with the full path", () => {
    const value = clonePackage(makeCanonicalPackage());
    value.package.folders[1].lists[0].cards[1].translation = "";
    const result = validateGlobalImportInput(value, null);
    expect(result.valid).toBe(false);
    expect(paths(result)).toContain("package.folders[1].lists[0].cards[1].translation");
  });

  it("rejects unknown fields", () => {
    const value = clonePackage(makeCanonicalPackage());
    value.package.folders[0].lists[0].cards[0].unexpected_field = "x";
    expect(validateGlobalImportInput(value, null).valid).toBe(false);
  });

  it("rejects changed folder order", () => {
    const original = makeCanonicalPackage();
    const value = clonePackage(original);
    value.package.folders.reverse();
    const result = validateGlobalImportInput(value, makeManifest(original));
    expect(result.valid).toBe(false);
    expect(paths(result).some((path) => path.endsWith("order_index"))).toBe(true);
  });

  it("rejects text above the 5 MB limit", () => {
    const text = "x".repeat(5 * 1024 * 1024 + 1);
    expect(() => parseGlobalImportText(text)).toThrow(/5 MB/i);
  });

  it("accepts a package containing exactly 5,000 cards", () => {
    const value = makeCanonicalPackage({ folders: 1, listsPerFolder: 1, cardsPerList: 5000 });
    const result = validateGlobalImportInput(value, makeManifest(value));
    expect(result.valid).toBe(true);
    expect(result.summary.cards).toBe(5000);
  });

  it("rejects more than 5,000 cards", () => {
    const value = clonePackage(makeCanonicalPackage({ folders: 1, listsPerFolder: 1, cardsPerList: 5000 }));
    value.package.folders[0].lists[0].cards.push({
      ...value.package.folders[0].lists[0].cards[0],
      term: "Card 5001",
      translation: "Extra",
    });
    value.package.folders[0].lists[0].expected_card_count = 5001;
    value.package.folders[0].expected_card_count = 5001;
    value.package.expected_card_count = 5001;
    const result = validateGlobalImportInput(value, null);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => /5\.?000/.test(issue.message))).toBe(true);
  });
});
