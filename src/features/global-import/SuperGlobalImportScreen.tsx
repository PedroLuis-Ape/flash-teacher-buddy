import { useAuth } from "@/contexts/AuthContext";
import GuidedGlobalImportScreen from "./GuidedGlobalImportScreen";
import OwnerGuidedImportWizard from "./OwnerGuidedImportWizard";
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

function legacyForced(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("superImport") === "legacy";
}

function ownerCanUseWizard(isOwnerCanary: boolean): boolean {
  if (!isOwnerCanary || typeof window === "undefined" || legacyForced()) return false;
  return window.localStorage.getItem(STORAGE_KEY) !== "disabled";
}

function globalGuidedEnabled(): boolean {
  if (typeof window === "undefined" || legacyForced()) return false;
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

  const isOwnerCanary = isOwnerCanaryAccount(user);
  if (ownerCanUseWizard(isOwnerCanary)) return <OwnerGuidedImportWizard />;
  if (globalGuidedEnabled()) return <GuidedGlobalImportScreen />;
  return <SuperGlobalImportScreenV2 />;
}
