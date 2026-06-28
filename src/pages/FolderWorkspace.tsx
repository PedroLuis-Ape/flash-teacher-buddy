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
        <div className="container mx-auto px-3 pb-24 sm:px-4">
          <section className="mt-4 space-y-3 rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Ferramentas da pasta</p>
                <p className="text-xs text-muted-foreground">Organize, exporte ou abra o glossário.</p>
              </div>
              <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                <ListSequenceDialog
                  folderId={id}
                  triggerClassName="!static !bottom-auto !right-auto !z-auto !max-w-none min-h-[40px] w-full justify-center rounded-xl px-3 shadow-none sm:w-auto"
                />
                <FolderExportDialog
                  sources={[{ id }]}
                  label="Exportar pasta"
                  className="min-h-[40px] w-full justify-center rounded-xl px-3 shadow-none sm:w-auto"
                  variant="default"
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
