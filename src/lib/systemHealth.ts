export type RuntimeHostKind = "canonical" | "apex" | "preview" | "other";

export interface SystemHealthSnapshot {
  hostname: string;
  hostKind: RuntimeHostKind;
  canonicalUrl: string;
  isOnline: boolean;
  mode: string;
  supabaseConfigured: boolean;
  supabaseProjectRef: string | null;
  persistedSessionDetected: boolean;
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

export function getSupabaseProjectRef(supabaseUrl?: string): string | null {
  if (!supabaseUrl) return null;

  try {
    const url = new URL(supabaseUrl);
    const [projectRef] = url.hostname.split(".");
    return projectRef || null;
  } catch {
    return null;
  }
}

export function hasPersistedSupabaseSession(
  storage: Pick<Storage, "getItem"> | null,
  projectRef: string | null,
): boolean {
  if (!storage || !projectRef) return false;

  try {
    return Boolean(storage.getItem(`sb-${projectRef}-auth-token`));
  } catch {
    return false;
  }
}

export function createSystemHealthSnapshot(input: {
  hostname: string;
  isOnline: boolean;
  mode: string;
  supabaseUrl?: string;
  storage?: Pick<Storage, "getItem"> | null;
}): SystemHealthSnapshot {
  const supabaseProjectRef = getSupabaseProjectRef(input.supabaseUrl);

  return {
    hostname: input.hostname,
    hostKind: classifyRuntimeHost(input.hostname),
    canonicalUrl: "https://www.apeeducation.org",
    isOnline: input.isOnline,
    mode: input.mode,
    supabaseConfigured: Boolean(input.supabaseUrl && supabaseProjectRef),
    supabaseProjectRef,
    persistedSessionDetected: hasPersistedSupabaseSession(
      input.storage ?? null,
      supabaseProjectRef,
    ),
  };
}
