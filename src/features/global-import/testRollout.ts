const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const TEST_MODES = new Set(["test", "wizard", "v3"]);
const STORAGE_KEY = "app-piteco:super-import-v3";

export interface SuperImportRolloutContext {
  search?: string;
  envValue?: unknown;
  storageValue?: unknown;
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

function getLegacyStorageValue(value?: unknown): string {
  if (value !== undefined) return normalized(value);
  if (typeof window === "undefined") return "";
  return normalized(window.localStorage.getItem(STORAGE_KEY));
}

export function isSuperImportTestRolloutEnabled(
  context: SuperImportRolloutContext = {},
): boolean {
  const mode = getSuperImportMode(context.search);
  if (mode === "legacy") return false;
  if (TEST_MODES.has(mode)) return true;
  if (getLegacyStorageValue(context.storageValue) === "disabled") return false;

  const envValue = context.envValue
    ?? import.meta.env.VITE_SUPER_IMPORT_TEST_ROLLOUT;
  return ENABLED_VALUES.has(normalized(envValue));
}
