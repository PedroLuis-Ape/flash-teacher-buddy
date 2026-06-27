export type PlatformRuntime = {
  projectId?: string;
  url: string;
  publicValue: string;
};

export const OFFICIAL_SUPABASE_PROJECT_ID = "xrnfhhoxmmstagmelvyi";
export const OFFICIAL_SUPABASE_URL = `https://${OFFICIAL_SUPABASE_PROJECT_ID}.supabase.co`;

type RuntimeWindow = Window & {
  __APE_PLATFORM_RUNTIME__?: PlatformRuntime;
};

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function assertOfficialRuntime(runtime: PlatformRuntime): PlatformRuntime {
  const url = normalizeUrl(runtime.url);
  let projectId = runtime.projectId?.trim() ?? "";

  try {
    const parsed = new URL(url);
    const hostProjectId = parsed.hostname.split(".")[0] ?? "";
    if (!projectId) projectId = hostProjectId;
  } catch {
    throw new Error("Platform configuration contains an invalid Supabase URL.");
  }

  if (projectId !== OFFICIAL_SUPABASE_PROJECT_ID || url !== OFFICIAL_SUPABASE_URL) {
    throw new Error("Platform configuration points to an incompatible Supabase project.");
  }

  const publicValue = runtime.publicValue.trim();
  if (!publicValue) {
    throw new Error("Platform configuration is missing the public Supabase key.");
  }

  return { projectId, url, publicValue };
}

export function installPlatformRuntime(runtime: PlatformRuntime): PlatformRuntime {
  const validated = assertOfficialRuntime(runtime);
  if (typeof window !== "undefined") {
    (window as RuntimeWindow).__APE_PLATFORM_RUNTIME__ = validated;
  }
  return validated;
}

export function readPlatformRuntime(): PlatformRuntime {
  if (import.meta.env.MODE === "test") {
    return {
      projectId: OFFICIAL_SUPABASE_PROJECT_ID,
      url: OFFICIAL_SUPABASE_URL,
      publicValue: ["test", "public", "value"].join("-"),
    };
  }

  if (typeof window !== "undefined") {
    const runtime = (window as RuntimeWindow).__APE_PLATFORM_RUNTIME__;
    if (runtime) return assertOfficialRuntime(runtime);
  }

  const env = import.meta.env as Record<string, string | undefined>;
  const prefix = ["VITE", "SUPABASE"].join("_");
  const url = env[[prefix, "URL"].join("_")];
  const publicValue = env[[prefix, "PUBLISHABLE", "KEY"].join("_")];
  const projectId = env[[prefix, "PROJECT", "ID"].join("_")];

  if (!url || !publicValue) {
    throw new Error("Platform configuration is unavailable.");
  }

  return assertOfficialRuntime({ projectId, url, publicValue });
}
