import type { UserScopedDb } from "./client";

export type CapabilityStatus = "ready" | "missing" | "unknown";

export interface PitecoCapabilitiesResult {
  contract_version: string | null;
  engine_version: string | null;
  migration_revision: string | null;
  project_ref: string | null;
  rpc_available: boolean;
  source: "rpc" | "unavailable";
  capability_rpc: string | null;
  capabilities: {
    basic_fields: CapabilityStatus;
    enriched_fields: CapabilityStatus;
    layered_cards: CapabilityStatus;
    glossary: CapabilityStatus;
    safe_import: CapabilityStatus;
  };
  fields: {
    basic: { status: CapabilityStatus; supported: string[] };
    enriched: { status: CapabilityStatus; supported: string[] };
  };
  layers: { status: CapabilityStatus; contract: string };
  glossary: { status: CapabilityStatus; contract: string };
  destinations: {
    personal: { status: "ready"; owner_only: true; supported: true };
    institutional: { status: "owner_only"; owner_only: true; supported: false; reason: string };
  };
  importers: {
    content: { rpc: string; status: CapabilityStatus; scope: "personal"; preserves: string[] };
    glossary: { rpc: string; status: CapabilityStatus; scope: "personal"; preserves: string[] };
  };
  limits: Record<string, number>;
  routing: {
    bulk: { route: string; tools: string[] };
    granular: { route: string; tools: string[] };
  };
  checks: Array<Record<string, unknown>>;
  diagnostic_codes: string[];
  availability_note?: string;
}

const LIMITS = Object.freeze({
  max_file_bytes: 50 * 1024 * 1024,
  max_folders: 200,
  max_lists: 1_000,
  max_cards: 20_000,
  max_glossary_entries: 20_000,
  max_text_length: 250_000,
  max_name_length: 160,
  max_word_hints_per_card: 200,
  max_layers_per_group: 500,
});

const BASIC_FIELDS = ["front", "back", "term", "translation"];
const ENRICHED_FIELDS = [
  "hint",
  "examples",
  "context_tag",
  "detailed_explanation",
  "usage_notes",
  "common_mistakes",
  "word_hints",
];

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function statusOf(value: unknown): CapabilityStatus {
  if (value === true || value === "ready") return "ready";
  if (value === false || value === "missing") return "missing";
  return "unknown";
}

function safeChecks(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const check = recordOf(item);
    if (!check) return [];
    return [{
      key: stringValue(check.key) ?? "unknown",
      code: stringValue(check.code) ?? "unknown",
      status: statusOf(check.status),
      required: check.required === true,
      detail: stringValue(check.detail) ?? "Diagnóstico sem detalhe.",
    }];
  });
}

function safeDiagnostics(value: unknown): string[] {
  if (!Array.isArray(value)) return ["unknown"];
  const values = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  return values.length ? values : ["unknown"];
}

function unavailableResult(): PitecoCapabilitiesResult {
  const unknown: CapabilityStatus = "unknown";
  return {
    contract_version: null,
    engine_version: null,
    migration_revision: null,
    project_ref: null,
    rpc_available: false,
    source: "unavailable",
    capability_rpc: null,
    capabilities: {
      basic_fields: unknown,
      enriched_fields: unknown,
      layered_cards: unknown,
      glossary: unknown,
      safe_import: unknown,
    },
    fields: {
      basic: { status: unknown, supported: BASIC_FIELDS },
      enriched: { status: unknown, supported: ENRICHED_FIELDS },
    },
    layers: { status: unknown, contract: "Smart Import 2.0" },
    glossary: { status: unknown, contract: "import_folder_glossary_v2" },
    destinations: {
      personal: { status: "ready", owner_only: true, supported: true },
      institutional: {
        status: "owner_only",
        owner_only: true,
        supported: false,
        reason: "O MCP desta versão expõe somente o destino pessoal.",
      },
    },
    importers: {
      content: {
        rpc: "import_app_piteco_super_package_current",
        status: unknown,
        scope: "personal",
        preserves: ["camadas", "campos enriquecidos", "glossário incorporado"],
      },
      glossary: {
        rpc: "import_folder_glossary_v2",
        status: unknown,
        scope: "personal",
        preserves: ["merge", "replace", "dry-run"],
      },
    },
    limits: { ...LIMITS },
    routing: {
      bulk: { route: "importadores oficiais", tools: ["preview_content_import", "execute_content_import", "preview_glossary_import", "execute_glossary_import"] },
      granular: { route: "tools granulares de cards/listas", tools: ["add_flashcards", "update_flashcards", "create_list", "update_list"] },
    },
    checks: [],
    diagnostic_codes: ["rpc"],
    availability_note: "get_import_capabilities_v2/v1 estão indisponíveis; nenhum suporte de importação foi inferido.",
  };
}

const CAPABILITY_RPCS = ["get_import_capabilities_v2", "get_import_capabilities_v1"] as const;

/**
 * Reads the authenticated capability RPCs in order. The v2 adds the official
 * folder glossary importer to the same contract; the v1 stays as the honest
 * fallback, where glossary remains `unknown` instead of a guessed `ready`.
 * It never falls back to a guessed contract.
 */
export async function getPitecoCapabilities(db: UserScopedDb): Promise<PitecoCapabilitiesResult> {
  for (const rpcName of CAPABILITY_RPCS) {
    const result = await readCapabilityRpc(db, rpcName);
    if (result) return result;
  }
  return unavailableResult();
}

async function readCapabilityRpc(db: UserScopedDb, rpcName: string): Promise<PitecoCapabilitiesResult | null> {
  let response: { data: unknown; error: unknown };
  try {
    response = await db.client.rpc(rpcName as never);
  } catch {
    return null;
  }
  if (response.error) return null;
  const payload = recordOf(response.data);
  if (!payload) return null;
  const raw = recordOf(payload.capabilities);
  // A payload without the capability object is not a capability answer; keep
  // looking instead of reporting a fabricated all-unknown "rpc" source.
  if (!raw) return null;
  const basic = statusOf(raw?.basic_import);
  const enriched = statusOf(raw?.enriched_fields);
  const layered = statusOf(raw?.layered_cards);
  const glossary = statusOf(raw?.glossary ?? raw?.glossary_import);
  const safe = statusOf(raw?.safe_import);
  return {
    contract_version: stringValue(payload.contract_version),
    engine_version: stringValue(payload.engine_version),
    migration_revision: stringValue(payload.migration_revision),
    project_ref: stringValue(payload.project_ref),
    rpc_available: true,
    source: "rpc",
    capability_rpc: rpcName,
    capabilities: {
      basic_fields: basic,
      enriched_fields: enriched,
      layered_cards: layered,
      glossary,
      safe_import: safe,
    },
    fields: {
      basic: { status: basic, supported: BASIC_FIELDS },
      enriched: { status: enriched, supported: ENRICHED_FIELDS },
    },
    layers: { status: layered, contract: "Smart Import 2.0" },
    glossary: { status: glossary, contract: "import_folder_glossary_v2" },
    destinations: {
      personal: { status: "ready", owner_only: true, supported: true },
      institutional: {
        status: "owner_only",
        owner_only: true,
        supported: false,
        reason: "O MCP desta versão expõe somente o destino pessoal.",
      },
    },
    importers: {
      content: {
        rpc: "import_app_piteco_super_package_current",
        status: safe,
        scope: "personal",
        preserves: ["camadas", "campos enriquecidos", "glossário incorporado"],
      },
      glossary: {
        rpc: "import_folder_glossary_v2",
        status: glossary,
        scope: "personal",
        preserves: ["merge", "replace", "dry-run"],
      },
    },
    limits: { ...LIMITS },
    routing: {
      bulk: { route: "importadores oficiais", tools: ["preview_content_import", "execute_content_import", "preview_glossary_import", "execute_glossary_import"] },
      granular: { route: "tools granulares de cards/listas", tools: ["add_flashcards", "update_flashcards", "create_list", "update_list"] },
    },
    checks: safeChecks(payload.checks),
    diagnostic_codes: safeDiagnostics(payload.diagnostic_codes),
  };
}
