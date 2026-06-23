import { useAuth } from "@/contexts/AuthContext";
import GuidedGlobalImportScreen from "./GuidedGlobalImportScreen";
import OwnerGuidedImportWizard from "./OwnerGuidedImportWizard";
import SuperGlobalImportScreenV2 from "./SuperGlobalImportScreenV2";
import {
  isSuperImportLegacyForced,
  isSuperImportTestRolloutEnabled,
} from "./testRollout";

function globalGuidedEnabled(): boolean {
  if (isSuperImportLegacyForced()) return false;
  return import.meta.env.VITE_SUPER_IMPORT_V3 === "true";
}

export default function SuperGlobalImportScreen() {
  const { initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Verificando acesso ao importador...
      </div>
    );
  }

  if (isSuperImportTestRolloutEnabled()) return <OwnerGuidedImportWizard />;
  if (globalGuidedEnabled()) return <GuidedGlobalImportScreen />;
  return <SuperGlobalImportScreenV2 />;
}
