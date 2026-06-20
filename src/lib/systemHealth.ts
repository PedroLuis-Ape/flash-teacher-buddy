export type RuntimeHostKind = "canonical" | "apex" | "preview" | "other";
export type BackendContractStatus =
  | "valid"
  | "missing"
  | "mismatch"
  | "invalid-url"
  | "invalid-key";

export interface SystemHealthSnapshot {
  hostname: string;
  hostKind: RuntimeHostKind;
  canonicalUrl: string;
  isOnline: boolean;
  mode: string;
  backendContract: BackendContractStatus;
}

export function classifyRuntimeHost(hostname: string): RuntimeHostKind {
  const normalized = hostname.trim().toLowerCase();

  if (normalized === "www.apeeducation.org") return "canonical";
  if (normalized === "apeeducation.org") return "apex";
  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized.endsWith(".netlify.app") ||
    normalized.endsWith(".lovable.app")
  ) {
    return "preview";
  }

  return "other";
}

function decodeJwtPayload(token: string): { role?: unknown; ref?: unknown } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(globalThis.atob(padded)) as { role?: unknown; ref?: unknown };
  } catch {
    return null;
  }
}

export function evaluateBackendContract(input: {
  projectId?: string;
  supabaseUrl?: string;
  publishableKey?: string;
}): BackendContractStatus {
  const projectId = input.projectId?.trim();
  const supabaseUrl = input.supabaseUrl?.trim();
  const publishableKey = input.publishableKey?.trim();

  if (!projectId || !supabaseUrl || !publishableKey) return "missing";

  let url: URL;
  try {
    url = new URL(supabaseUrl);
  } catch {
    return "invalid-url";
  }

  const expectedHostname = `${projectId}.supabase.co`;
  const rootPath = url.pathname === "" || url.pathname === "/";

  if (
    url.protocol !== "https:" ||
    url.hostname !== expectedHostname ||
    !rootPath ||
    url.username ||
    url.password
  ) {
    return "mismatch";
  }

  if (publishableKey.startsWith("sb_publishable_")) {
    return publishableKey.length > "sb_publishable_".length ? "valid" : "invalid-key";
  }

  const payload = decodeJwtPayload(publishableKey);
  if (!payload || payload.role !== "anon") return "invalid-key";
  if (typeof payload.ref === "string" && payload.ref !== projectId) return "mismatch";

  return "valid";
}

export function createSystemHealthSnapshot(input: {
  hostname: string;
  isOnline: boolean;
  mode: string;
  backendProjectId?: string;
  backendUrl?: string;
  backendPublishableKey?: string;
}): SystemHealthSnapshot {
  return {
    hostname: input.hostname,
    hostKind: classifyRuntimeHost(input.hostname),
    canonicalUrl: "https://www.apeeducation.org",
    isOnline: input.isOnline,
    mode: input.mode,
    backendContract: evaluateBackendContract({
      projectId: input.backendProjectId,
      supabaseUrl: input.backendUrl,
      publishableKey: input.backendPublishableKey,
    }),
  };
}
