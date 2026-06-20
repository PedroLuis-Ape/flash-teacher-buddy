export type RuntimeHostKind = "canonical" | "apex" | "preview" | "other";
export type BackendContractStatus = "valid" | "missing" | "mismatch" | "invalid-url";

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

export function evaluateBackendContract(input: {
  projectId?: string;
  supabaseUrl?: string;
}): BackendContractStatus {
  const projectId = input.projectId?.trim();
  const supabaseUrl = input.supabaseUrl?.trim();

  if (!projectId || !supabaseUrl) return "missing";

  try {
    const url = new URL(supabaseUrl);
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

    return "valid";
  } catch {
    return "invalid-url";
  }
}

export function createSystemHealthSnapshot(input: {
  hostname: string;
  isOnline: boolean;
  mode: string;
  backendProjectId?: string;
  backendUrl?: string;
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
    }),
  };
}
