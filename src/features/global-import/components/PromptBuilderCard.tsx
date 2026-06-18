import type { GlobalImportDestinationMode } from "../destinationModes";
import { GlobalImportAiSection } from "./GlobalImportAiSection";

interface PromptBuilderCardProps {
  mode: GlobalImportDestinationMode;
  destinationFolderName?: string;
}

export function PromptBuilderCard(props: PromptBuilderCardProps) {
  return <GlobalImportAiSection {...props} />;
}
