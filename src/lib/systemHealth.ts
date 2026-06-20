export type RuntimeHostKind = "canonical" | "apex" | "preview" | "other";

export interface SystemHealthSnapshot {
  hostname: string;
  hostKind: RuntimeHostKind;
  canonicalUrl: string;
  isOnline: boolean;
  mode: string;
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

export function createSystemHealthSnapshot(input: {
  hostname: string;
  isOnline: boolean;
  mode: string;
}): SystemHealthSnapshot {
  return {
    hostname: input.hostname,
    hostKind: classifyRuntimeHost(input.hostname),
    canonicalUrl: "https://www.apeeducation.org",
    isOnline: input.isOnline,
    mode: input.mode,
  };
}
