const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const TEST_MODES = new Set(["test", "wizard", "v3"]);

export interface SuperImportRolloutContext {
  search?: string;
  envValue?: unknown;
}

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function getSuperImportMode(search?: string): string {
  const resolvedSearch = search
    ?? (typeof window !== "undefined" ? window.location.search : "");
  return normalized(new URLSearchParams(resolvedSearch).get("superImport"));
}

export function isSuperImportLegacyForced(search?: string): boolean {
  return getSuperImportMode(search) === "legacy";
}

export function isSuperImportTestRolloutEnabled(
  context: SuperImportRolloutContext = {},
): boolean {
  const mode = getSuperImportMode(context.search);
  if (mode === "legacy") return false;
  if (TEST_MODES.has(mode)) return true;

  const envValue = context.envValue
    ?? import.meta.env.VITE_SUPER_IMPORT_TEST_ROLLOUT;
  return ENABLED_VALUES.has(normalized(envValue));
}
