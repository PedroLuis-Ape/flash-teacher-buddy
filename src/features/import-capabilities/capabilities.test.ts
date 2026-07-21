import { describe, expect, it } from "vitest";
import { smartImportPackageSchema, withSmartDeclaredTotals } from "@/features/smart-import/schema";
import {
  BASE_IMPORT_CAPABILITIES,
  evaluateImportCapabilities,
  requirementsForPackage,
  type ImportCapabilitiesReport,
} from "./capabilities";

function report(overrides: Partial<ImportCapabilitiesReport> = {}): ImportCapabilitiesReport {
  return {
    contractVersion: "1",
    engineVersion: "2.0",
    migrationRevision: "20260712223000",
    projectRef: "xrnfhhoxmmstagmelvyi",
    runtimeUrl: "https://xrnfhhoxmmstagmelvyi.supabase.co",
    buildId: "test",
    rpcAvailable: true,
    capabilities: {
      safe_import: "ready",
      basic_import: "ready",
      enriched_fields: "ready",
      layered_cards: "ready",
    },
    checks: [],
    diagnosticCodes: ["unknown"],
    errorMessage: null,
    ...overrides,
  };
}

describe("import capability preflight", () => {
  it("requires only the safe/basic contract for simple cards", () => {
    expect(requirementsForPackage(null)).toEqual(BASE_IMPORT_CAPABILITIES);
    expect(evaluateImportCapabilities(report(), BASE_IMPORT_CAPABILITIES).ready).toBe(true);
  });

  it("requires layered capability without silently downgrading", () => {
    const packageValue = smartImportPackageSchema.parse(withSmartDeclaredTotals({
      schema: "app-piteco-super-import",
      version: "2.0",
      package: {
        name: "Camadas",
        folders: [{
          name: "Pasta",
          lists: [{
            name: "Lista",
            front_language: "en",
            back_language: "pt-BR",
            primary_side: "a",
            study_type: "language",
            glossary: [],
            cards: [{ type: "layered", group_title: "get", layers: [
              { front: "get", back: "obter", word_hints: [] },
              { front: "get", back: "entender", word_hints: [] },
            ] }],
          }],
        }],
      },
    }));
    const requirements = requirementsForPackage(packageValue);
    expect(requirements).toContain("layered_cards");
    expect(evaluateImportCapabilities(report({ capabilities: { ...report().capabilities, layered_cards: "missing" } }), requirements).ready).toBe(false);
  });

  it("fails closed for an absent RPC or unknown response", () => {
    const evaluation = evaluateImportCapabilities(report({ rpcAvailable: false, capabilities: {
      safe_import: "unknown",
      basic_import: "unknown",
      enriched_fields: "unknown",
      layered_cards: "unknown",
    } }), BASE_IMPORT_CAPABILITIES);
    expect(evaluation.ready).toBe(false);
    expect(evaluation.missing).toEqual(expect.arrayContaining(BASE_IMPORT_CAPABILITIES));
  });
});
