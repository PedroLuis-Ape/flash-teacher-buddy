import GuidedGlobalImportScreen from "./GuidedGlobalImportScreen";
import SuperGlobalImportScreenV2 from "./SuperGlobalImportScreenV2";

const STORAGE_KEY = "app-piteco:super-import-v3";

function useGuidedVersion(): boolean {
  if (typeof window === "undefined") return false;
  const forced = new URLSearchParams(window.location.search).get("superImport");
  if (forced === "v3") return true;
  if (forced === "legacy") return false;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "enabled") return true;
  if (stored === "disabled") return false;
  return import.meta.env.VITE_SUPER_IMPORT_V3 === "true";
}

export default function SuperGlobalImportScreen() {
  return useGuidedVersion() ? <GuidedGlobalImportScreen /> : <SuperGlobalImportScreenV2 />;
}
