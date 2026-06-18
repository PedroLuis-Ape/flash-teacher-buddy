import { describe, expect, it } from "vitest";
import { parseGlobalImportText } from "../parser";
import { validateGlobalImportInput } from "../validation";
import {
  clonePackage,
  makeCanonicalPackage,
  makeManifest,
  makeOfficialPackage,
} from "./fixtures";

function codes(value: ReturnType<typeof validateGlobalImportInput>): string[] {
  return value.issues.map((issue) => issue.code);
}

function paths(value: ReturnType<typeof validateGlobalImportInput>): string[] {
  return value.issues.map((issue) => issue.path);
}

describe("official app-piteco-super-import validation", () => {
  it("accepts a valid package without a local manifest", () => {
    const value = makeOfficialPackage();
    const result = validateGlobalImportInput(value, null);
    expect(result.valid).toBe(true);
    expect(result.sourceFormat).toBe("official");
    expect(result.officialPackage).not.toBeNull();
    expect(result.requestId).toBeNull();
    expect(result.summary).toEqual({ folders: 2, lists: 4, cards: 12 });
  });

  it("preserves a different language direction in each list", () => {
    const result = validateGlobalImportInput(makeOfficialPackage(), null);
    expect(result.package?.package.source_language).toBe("en");
    const firstMetadata = result.package?.package.folders[0].lists[0].cards[0].metadata;
    const secondMetadata = result.package?.package.folders[0].lists[1].cards[0].metadata;
    expect(firstMetadata).toMatchObject({ front_language: "en", back_language: "pt-BR" });
    expect(secondMetadata).toMatchObject({ front_language: "pt-BR", back_language: "en" });
  });

  it("blocks a declared count different from the real count", () => {
    const value: any = clonePackage(makeOfficialPackage());
    value.package.folders[0].lists[0].cards.pop();
    const result = validateGlobalImportInput(value, null);
    expect(result.valid).toBe(false);
    expect(codes(result)).toContain("E_COUNT_MISMATCH");
    expect(paths(result)).toContain("package.folders[0].lists[0].declared_card_count");
  });

  it("rejects an unknown card field", () => {
    const value: any = clonePackage(makeOfficialPackage());
    value.package.folders[0].lists[0].cards[0].hint = "não permitido";
    const result = validateGlobalImportInput(value, null);
    expect(result.valid).toBe(false);
    expect(codes(result)).toContain("E_SCHEMA");
  });

  it("rejects an invalid language code", () => {
    const value: any = clonePackage(makeOfficialPackage());
    value.package.folders[0].lists[0].front_language = "english";
    const result = validateGlobalImportInput(value, null);
    expect(result.valid).toBe(false);
    expect(codes(result)).toContain("E_LANGUAGE");
  });

  it("rejects a duplicate card inside the same list", () => {
    const value: any = clonePackage(makeOfficialPackage());
    value.package.folders[0].lists[0].cards[1] = clonePackage(value.package.folders[0].lists[0].cards[0]);
    const result = validateGlobalImportInput(value, null);
    expect(result.valid).toBe(false);
    expect(codes(result)).toContain("E_DUPLICATE_CARD");
  });

  it("accepts a single outer JSON fence", () => {
    const value = makeOfficialPackage({ folders: 1, listsPerFolder: 1, cardsPerList: 1 });
    const parsed = parseGlobalImportText(`\`\`\`json\n${JSON.stringify(value)}\n\`\`\``);
    expect(parsed.extracted).toBe(true);
    expect(validateGlobalImportInput(parsed.value, null).valid).toBe(true);
  });

  it("rejects explanatory text around the JSON", () => {
    const value = makeOfficialPackage({ folders: 1, listsPerFolder: 1, cardsPerList: 1 });
    expect(() => parseGlobalImportText(`Aqui está:\n${JSON.stringify(value)}`)).toThrow(/JSON válido/i);
  });

  it("rejects trailing commas instead of silently repairing them", () => {
    expect(() => parseGlobalImportText('{"schema":"app-piteco-super-import",}')).toThrow(/vírgula final/i);
  });

  it("detects a cut JSON response", () => {
    expect(() => parseGlobalImportText('{"schema":"app-piteco-super-import","package":{')).toThrow(/cortado/i);
  });

  it("rejects text above the 10 MB limit", () => {
    const text = "x".repeat(10 * 1024 * 1024 + 1);
    expect(() => parseGlobalImportText(text)).toThrow(/10 MB/i);
  });
});

describe("compatibility formats", () => {
  it("continues accepting ape-global-import with its manifest", () => {
    const value = makeCanonicalPackage();
    const result = validateGlobalImportInput(value, makeManifest(value));
    expect(result.valid).toBe(true);
    expect(result.sourceFormat).toBe("canonical");
    expect(result.summary).toEqual({ folders: 2, lists: 4, cards: 12 });
  });

  it("still requires a local manifest for ape-global-import", () => {
    const result = validateGlobalImportInput(makeCanonicalPackage(), null);
    expect(result.valid).toBe(false);
    expect(codes(result)).toContain("manifest.missing");
  });

  it("rejects an incompatible old schema version", () => {
    const value: any = clonePackage(makeCanonicalPackage());
    value.schema_version = 2;
    const result = validateGlobalImportInput(value, null);
    expect(result.valid).toBe(false);
    expect(paths(result)).toContain("schema_version");
  });
});
