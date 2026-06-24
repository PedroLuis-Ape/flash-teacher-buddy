import { FolderGlossaryAiPromptCard } from "./FolderGlossaryAiPromptCard";
import { FolderGlossaryManager as FolderGlossaryManagerCore } from "./FolderGlossaryManagerCore";

interface Props {
  folderId: string;
  folderTitle: string;
  labelA: string;
  labelB: string;
}

export function FolderGlossaryManager(props: Props) {
  return (
    <div className="space-y-4">
      <FolderGlossaryAiPromptCard
        folderId={props.folderId}
        folderTitle={props.folderTitle}
        labelA={props.labelA}
        labelB={props.labelB}
      />
      <FolderGlossaryManagerCore {...props} />
    </div>
  );
}
