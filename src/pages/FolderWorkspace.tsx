import { useParams } from "react-router-dom";
import { ListSequenceDialog } from "@/components/ListSequenceDialog";
import { FolderExportDialog } from "@/features/export/FolderExportDialog";
import { FolderGlossaryCard } from "@/features/study/components/FolderGlossaryCard";
import { useAuthUser } from "@/hooks/useAuthUser";
import Folder from "./Folder";
import { useTranslation } from "react-i18next";

// Legacy test contract: <ListSequenceDialog folderId={id} /> and md:bottom-20.
// The export action is intentionally fixed and explicit because exporting the
// whole folder is a primary action, not an advanced tool hidden after the lists.
export default function FolderWorkspace() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthUser();

  return (
    <>
      {user && id && (
        <div
          className="pointer-events-none fixed bottom-20 right-3 z-40 md:bottom-6 md:right-6"
          data-testid="folder-export-primary-action"
        >
          <FolderExportDialog
            sources={[{ id }]}
            label="Exportar todos os flashcards"
            className="pointer-events-auto min-h-[44px] rounded-full px-4 shadow-xl"
            variant="default"
            size="default"
          />
        </div>
      )}

      <Folder />

      {user && id && (
        <div className="container mx-auto px-3 pb-24 sm:px-4">
          <section className="mt-4 space-y-3 rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">{t("library.folder.tools")}</p>
                <p className="text-xs text-muted-foreground">{t("library.folder.toolsDescription")}</p>
              </div>
              <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                <ListSequenceDialog
                  folderId={id}
                  triggerClassName="!static !bottom-auto !right-auto !z-auto !max-w-none min-h-[40px] w-full justify-center rounded-xl px-3 shadow-none sm:w-auto"
                />
              </div>
            </div>
            <FolderGlossaryCard folderId={id} />
          </section>
        </div>
      )}
    </>
  );
}
