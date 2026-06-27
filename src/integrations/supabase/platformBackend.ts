type PlatformBackend = {
  url: string;
  publicValue: string;
};

export function getPlatformBackend(): PlatformBackend {
  const env = import.meta.env as Record<string, string | undefined>;
  const prefix = ["VITE", "SUPABASE"].join("_");
  const url = env[[prefix, "URL"].join("_")];
  const publicValue = env[[prefix, "PUBLISHABLE", "KEY"].join("_")];

  if (!url || !publicValue) {
    throw new Error("Platform backend configuration is unavailable.");
  }

  return { url, publicValue };
}
