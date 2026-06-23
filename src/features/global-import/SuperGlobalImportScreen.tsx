import { useAuth } from "@/contexts/AuthContext";
import GuidedGlobalImportScreen from "./GuidedGlobalImportScreen";
import SuperGlobalImportScreenV2 from "./SuperGlobalImportScreenV2";

const STORAGE_KEY = "app-piteco:super-import-v3";

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isOwnerCanaryAccount(user: ReturnType<typeof useAuth>["user"]): boolean {
  const configuredOwnerEmail = normalizeEmail(import.meta.env.VITE_OWNER_EMAIL);
  const authenticatedEmail = normalizeEmail(user?.email);
  return Boolean(
    configuredOwnerEmail
      && authenticatedEmail
      && configuredOwnerEmail === authenticatedEmail,
  );
}

function shouldUseGuidedVersion(isOwnerCanary: boolean): boolean {
  if (typeof window === "undefined") return false;

  const forced = new URLSearchParams(window.location.search).get("superImport");
  if (forced === "legacy") return false;

  if (isOwnerCanary) {
    if (forced === "v3") return true;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "disabled") return false;
    return true;
  }

  return import.meta.env.VITE_SUPER_IMPORT_V3 === "true";
}

export default function SuperGlobalImportScreen() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Verificando acesso ao importador...
      </div>
    );
  }

  const guided = shouldUseGuidedVersion(isOwnerCanaryAccount(user));
  return guided ? <GuidedGlobalImportScreen /> : <SuperGlobalImportScreenV2 />;
}
