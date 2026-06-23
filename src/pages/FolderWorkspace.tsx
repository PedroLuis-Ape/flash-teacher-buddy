import { useParams } from "react-router-dom";
import { FolderExportDialog } from "@/features/export/FolderExportDialog";
import { FolderGlossarySyncDialog } from "@/features/study/components/FolderGlossarySyncDialog";
import { useAuthUser } from "@/hooks/useAuthUser";
import Folder from "./Folder";

export default function FolderWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthUser();
  return <>
    <Folder />
    {user && id && <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-2 md:bottom-6 md:right-6 md:flex-row">
      <FolderGlossarySyncDialog folderId={id} label="Sincronizar glossário" />
      <FolderExportDialog sources={[{ id }]} label="Exportar pasta" className="min-h-[44px] shadow-lg" variant="default" />
    </div>}
  </>;
}
