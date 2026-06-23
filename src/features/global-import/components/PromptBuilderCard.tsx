import { useParams } from "react-router-dom";
import type { GlobalImportDestinationMode } from "../destinationModes";
import type { GlobalImportPromptDestinationContext } from "../prompts/presets";
import { ClassroomCompletePromptCard } from "./ClassroomCompletePromptCard";
import { GlobalImportAiSection } from "./GlobalImportAiSection";

interface PromptBuilderCardProps {
  mode: GlobalImportDestinationMode;
  destinationFolderName?: string;
}

export function PromptBuilderCard({ mode, destinationFolderName }: PromptBuilderCardProps) {
  const { turmaId } = useParams<{ turmaId?: string }>();

  if (turmaId) {
    const context: GlobalImportPromptDestinationContext = {
      scope: "classroom",
      intent: "structured",
      destinationMode: mode,
      folderName: destinationFolderName,
    };
    return <ClassroomCompletePromptCard context={context} />;
  }

  return <GlobalImportAiSection mode={mode} destinationFolderName={destinationFolderName} />;
}
