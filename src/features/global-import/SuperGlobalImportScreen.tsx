import { useAuth } from "@/contexts/AuthContext";
import OwnerGuidedImportWizard from "./OwnerGuidedImportWizard";

export default function SuperGlobalImportScreen() {
  const { initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Preparando o importador...
      </div>
    );
  }

  return <OwnerGuidedImportWizard />;
}
