import type { SmartImportPackage } from "@/features/smart-import/schema";
import { supabase } from "@/integrations/supabase/client";
import { readPlatformRuntime } from "@/integrations/supabase/platformRuntime";
import { richImportRequirements } from "@/features/global-import/richImportRequirements";

export type ImportCapabilityKey = "safe_import" | "layered_cards" | "enriched_fields" | "basic_import";
export type CapabilityStatus = "ready" | "missing" | "unknown";
export type CapabilityDiagnosticCode = "connection" | "project" | "migration" | "rpc" | "grant" | "schema" | "auth" | "unknown";

export interface ImportCapabilityCheck {
  key: string;
  code: CapabilityDiagnosticCode;
  status: CapabilityStatus;
  required: boolean;
  detail: string;
}

export interface ImportCapabilitiesReport {
  contractVersion: string | null;
  engineVersion: string | null;
  migrationRevision: string | null;
  projectRef: string | null;
  runtimeUrl: string;
  buildId: string | null;
  rpcAvailable: boolean;
  capabilities: Record<ImportCapabilityKey, CapabilityStatus>;
  checks: ImportCapabilityCheck[];
  diagnosticCodes: CapabilityDiagnosticCode[];
  errorMessage: string | null;
}

export const BASE_IMPORT_CAPABILITIES: ImportCapabilityKey[] = ["basic_import", "safe_import"];

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function diagnosticCode(value: unknown): CapabilityDiagnosticCode {
  return ["connection", "project", "migration", "rpc", "grant", "schema", "auth", "unknown"].includes(value as string)
    ? value as CapabilityDiagnosticCode
    : "unknown";
}

function statusValue(value: unknown): CapabilityStatus {
  return value === "ready" || value === "missing" || value === "unknown" ? value : "unknown";
}

function runtimeProjectRef(url: string, projectId?: string): string | null {
  if (projectId) return projectId;
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function emptyCapabilities(status: CapabilityStatus): Record<ImportCapabilityKey, CapabilityStatus> {
  return {
    safe_import: status,
    layered_cards: status,
    enriched_fields: status,
    basic_import: status,
  };
}

function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  const record = recordOf(error);
  return stringValue(record?.message) ?? "Não foi possível diagnosticar o banco conectado.";
}

function diagnosticFromError(error: unknown): CapabilityDiagnosticCode {
  const record = recordOf(error);
  const code = stringValue(record?.code)?.toUpperCase();
  const message = errorMessageOf(error).toLowerCase();
  if (code === "PGRST202" || message.includes("could not find the function") || message.includes("schema cache")) return "rpc";
  if (code === "401" || message.includes("jwt") || message.includes("auth")) return "auth";
  if (message.includes("network") || message.includes("fetch") || message.includes("failed to fetch")) return "connection";
  return "unknown";
}

export async function fetchImportCapabilities(): Promise<ImportCapabilitiesReport> {
  const runtime = readPlatformRuntime();
  const projectRef = runtimeProjectRef(runtime.url, runtime.projectId);
  try {
    const { data, error } = await supabase.rpc("get_import_capabilities_v1" as any);
    if (error) throw error;
    const payload = recordOf(data);
    if (!payload) throw new Error("O diagnóstico retornou uma resposta desconhecida.");

    const rawCapabilities = recordOf(payload.capabilities);
    const capabilities = emptyCapabilities("unknown");
    (Object.keys(capabilities) as ImportCapabilityKey[]).forEach((key) => {
      capabilities[key] = statusValue(rawCapabilities?.[key]);
    });

    const checks = Array.isArray(payload.checks)
      ? payload.checks.flatMap((value): ImportCapabilityCheck[] => {
          const check = recordOf(value);
          if (!check) return [];
          return [{
            key: stringValue(check.key) ?? "unknown",
            code: diagnosticCode(check.code),
            status: statusValue(check.status),
            required: check.required === true,
            detail: stringValue(check.detail) ?? "Diagnóstico sem detalhe.",
          }];
        })
      : [];
    const codes: CapabilityDiagnosticCode[] = Array.isArray(payload.diagnostic_codes)
      ? payload.diagnostic_codes.map(diagnosticCode)
      : ["unknown"];

    return {
      contractVersion: stringValue(payload.contract_version),
      engineVersion: stringValue(payload.engine_version),
      migrationRevision: stringValue(payload.migration_revision),
      projectRef: stringValue(payload.project_ref) ?? projectRef,
      runtimeUrl: runtime.url,
      buildId: stringValue(import.meta.env.VITE_BUILD_ID),
      rpcAvailable: true,
      capabilities,
      checks,
      diagnosticCodes: codes.length ? codes : ["unknown"],
      errorMessage: null,
    };
  } catch (error: unknown) {
    const code = diagnosticFromError(error);
    return {
      contractVersion: null,
      engineVersion: null,
      migrationRevision: null,
      projectRef,
      runtimeUrl: runtime.url,
      buildId: stringValue(import.meta.env.VITE_BUILD_ID),
      rpcAvailable: false,
      capabilities: emptyCapabilities("unknown"),
      checks: [{
        key: "capability_rpc",
        code,
        status: "unknown",
        required: true,
        detail: `O diagnóstico unificado não respondeu: ${errorMessageOf(error)}`,
      }],
      diagnosticCodes: [code],
      errorMessage: errorMessageOf(error),
    };
  }
}

export function requirementsForPackage(packageValue?: SmartImportPackage | null): ImportCapabilityKey[] {
  const requirements = new Set<ImportCapabilityKey>(BASE_IMPORT_CAPABILITIES);
  if (packageValue) {
    for (const requirement of richImportRequirements(packageValue)) {
      requirements.add(requirement === "cards em camadas" ? "layered_cards" : "enriched_fields");
    }
  }
  return Array.from(requirements);
}

export function evaluateImportCapabilities(
  report: ImportCapabilitiesReport | null | undefined,
  requirements: ImportCapabilityKey[] = BASE_IMPORT_CAPABILITIES,
) {
  const missing = requirements.filter((key) => report?.capabilities[key] !== "ready");
  const failedChecks = (report?.checks ?? []).filter((check) => check.status !== "ready");
  return {
    ready: Boolean(report?.rpcAvailable && missing.length === 0),
    missing,
    failedChecks,
    diagnosticCodes: report?.diagnosticCodes ?? ["unknown"],
  };
}

export function capabilityLabel(key: ImportCapabilityKey): string {
  return {
    safe_import: "Importação segura e reversível",
    layered_cards: "Cards em camadas",
    enriched_fields: "Campos enriquecidos e glossário",
    basic_import: "Importação básica",
  }[key];
}
