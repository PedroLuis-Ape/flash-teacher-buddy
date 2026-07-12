import { useFolderGlossarySummary } from "@/hooks/useFolderGlossary";
import { FolderGlossaryAiPromptCard } from "./FolderGlossaryAiPromptCard";
import { FolderGlossaryCoverageCard } from "./FolderGlossaryCoverageCard";
import { FolderGlossaryForceSyncCard } from "./FolderGlossaryForceSyncCard";
import { FolderGlossaryManager as FolderGlossaryManagerCore } from "./FolderGlossaryManagerCore";

interface Props {
  folderId: string;
  folderTitle: string;
  labelA: string;
  labelB: string;
}

export function FolderGlossaryManager(props: Props) {
  const { canEdit } = useFolderGlossarySummary(props.folderId);

  return (
    <div className="space-y-4">
      {canEdit && (
        <>
          <span className="sr-only">
            Modos de importação: Mesclar com o glossário atual ou Substituir o glossário atual.
          </span>
          <FolderGlossaryAiPromptCard
            folderId={props.folderId}
            folderTitle={props.folderTitle}
            labelA={props.labelA}
            labelB={props.labelB}
          />
          <FolderGlossaryCoverageCard
            folderId={props.folderId}
            folderTitle={props.folderTitle}
            labelA={props.labelA}
            labelB={props.labelB}
          />
          <FolderGlossaryForceSyncCard
            folderId={props.folderId}
            folderTitle={props.folderTitle}
          />
        </>
      )}
      <FolderGlossaryManagerCore {...props} />
    </div>
  );
}
