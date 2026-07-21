import { beforeEach, describe, expect, it, vi } from "vitest";
import { smartImportPackageSchema, withSmartDeclaredTotals } from "@/features/smart-import/schema";
import {
  BASE_IMPORT_CAPABILITIES,
  evaluateImportCapabilities,
  fetchImportCapabilities,
  requirementsForPackage,
  type ImportCapabilitiesReport,
} from "./capabilities";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  readPlatformRuntime: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));

vi.mock("@/integrations/supabase/platformRuntime", () => ({
  PRODUCTION_DATA_PROJECT_ID: "ymahldldyxvwjeruaxpr",
  readPlatformRuntime: mocks.readPlatformRuntime,
}));

function report(overrides: Partial<ImportCapabilitiesReport> = {}): ImportCapabilitiesReport {
  return {
    contractVersion: "1",
    engineVersion: "2.0",
    migrationRevision: "20260712223000",
    projectRef: "xrnfhhoxmmstagmelvyi",
    runtimeUrl: "https://xrnfhhoxmmstagmelvyi.supabase.co",
    buildId: "test",
    rpcAvailable: true,
    source: "rpc",
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
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.readPlatformRuntime.mockReset();
    mocks.readPlatformRuntime.mockReturnValue({
      projectId: "ymahldldyxvwjeruaxpr",
      url: "https://ymahldldyxvwjeruaxpr.supabase.co",
      publicValue: "test",
    });
  });

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
    const evaluation = evaluateImportCapabilities(report({ rpcAvailable: false, source: "unavailable", capabilities: {
      safe_import: "unknown",
      basic_import: "unknown",
      enriched_fields: "unknown",
      layered_cards: "unknown",
    } }), BASE_IMPORT_CAPABILITIES);
    expect(evaluation.ready).toBe(false);
    expect(evaluation.missing).toEqual(expect.arrayContaining(BASE_IMPORT_CAPABILITIES));
  });

  it("enables only the production basic contract when the capabilities RPC is absent", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.get_import_capabilities_v1 without parameters in the schema cache",
      },
    });

    const result = await fetchImportCapabilities();

    expect(result.source).toBe("production-basic-compatibility");
    expect(result.rpcAvailable).toBe(false);
    expect(result.capabilities.basic_import).toBe("ready");
    expect(result.capabilities.safe_import).toBe("ready");
    expect(result.capabilities.layered_cards).toBe("unknown");
    expect(result.capabilities.enriched_fields).toBe("unknown");
    expect(result.checks[0]?.detail).toContain("será confirmado antes da gravação");
    expect(evaluateImportCapabilities(result, BASE_IMPORT_CAPABILITIES).ready).toBe(true);
    expect(evaluateImportCapabilities(result, [...BASE_IMPORT_CAPABILITIES, "layered_cards"]).ready).toBe(false);
  });

  it("does not enable compatibility for a different project", async () => {
    mocks.readPlatformRuntime.mockReturnValue({
      projectId: "another-project",
      url: "https://another-project.supabase.co",
      publicValue: "test",
    });
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function in the schema cache" },
    });

    const result = await fetchImportCapabilities();

    expect(result.source).toBe("unavailable");
    expect(evaluateImportCapabilities(result, BASE_IMPORT_CAPABILITIES).ready).toBe(false);
  });

  it("keeps network and authentication failures closed in production", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("Failed to fetch") });
    const network = await fetchImportCapabilities();
    expect(network.source).toBe("unavailable");
    expect(network.diagnosticCodes).toEqual(["connection"]);

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "401", message: "JWT expired" } });
    const auth = await fetchImportCapabilities();
    expect(auth.source).toBe("unavailable");
    expect(auth.diagnosticCodes).toEqual(["auth"]);
  });
});
