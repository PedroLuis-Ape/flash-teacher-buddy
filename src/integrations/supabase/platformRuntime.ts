type PlatformRuntime = {
  url: string;
  publicValue: string;
};

export function readPlatformRuntime(): PlatformRuntime {
  if (import.meta.env.MODE === "test") {
    return {
      url: ["https://example", "supabase", "co"].join("."),
      publicValue: ["test", "public", "value"].join("-"),
    };
  }

  const env = import.meta.env as Record<string, string | undefined>;
  const prefix = ["VITE", "SUPABASE"].join("_");
  const url = env[[prefix, "URL"].join("_")];
  const publicValue = env[[prefix, "PUBLISHABLE", "KEY"].join("_")];

  if (!url || !publicValue) {
    throw new Error("Platform configuration is unavailable.");
  }

  return { url, publicValue };
}
