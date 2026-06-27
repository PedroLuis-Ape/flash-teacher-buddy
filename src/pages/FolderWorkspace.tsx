import { useParams } from "react-router-dom";
import { ListSequenceDialog } from "@/components/ListSequenceDialog";
import { FolderExportDialog } from "@/features/export/FolderExportDialog";
import { FolderGlossaryCard } from "@/features/study/components/FolderGlossaryCard";
import { useAuthUser } from "@/hooks/useAuthUser";
import Folder from "./Folder";

export default function FolderWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthUser();

  return (
    <>
      <Folder />

      {user && id && (
        <div className="container mx-auto space-y-3 px-3 pb-24 sm:px-4 md:contents">
          <section className="space-y-2" aria-label="Glossário e organização da pasta">
            <div className="flex justify-end">
              <ListSequenceDialog
                folderId={id}
                triggerClassName="!static !bottom-auto !right-auto !z-auto !max-w-none h-9 rounded-xl px-3 text-xs shadow-none"
              />
            </div>
            <FolderGlossaryCard folderId={id} />
          </section>

          <section aria-label="Ações da pasta">
            <div className="rounded-2xl border bg-card p-3 shadow-sm md:contents">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground md:hidden">
                Ações da pasta
              </p>
              <FolderExportDialog
                sources={[{ id }]}
                label="Exportar pasta"
                className="min-h-[44px] w-full shadow-none md:fixed md:bottom-20 md:right-6 md:z-40 md:w-auto md:shadow-lg"
                variant="default"
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
