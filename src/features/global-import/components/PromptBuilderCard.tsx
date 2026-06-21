import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { GlobalImportDestinationMode } from "../destinationModes";
import { loadImportDestinationCatalog, type ImportDestinationCatalog } from "../destination";
import { GlobalImportAiSection } from "./GlobalImportAiSection";
import { BulkGlossaryImportCard } from "./BulkGlossaryImportCard";

interface PromptBuilderCardProps {
  mode: GlobalImportDestinationMode;
  destinationFolderName?: string;
}

export function PromptBuilderCard(props: PromptBuilderCardProps) {
  const { turmaId } = useParams<{ turmaId?: string }>();
  const [catalog, setCatalog] = useState<ImportDestinationCatalog | null>(null);

  useEffect(() => {
    loadImportDestinationCatalog(turmaId)
      .then(setCatalog)
      .catch(() => setCatalog({ folders: [], lists: [] }));
  }, [turmaId]);

  return (
    <div className="space-y-6">
      <BulkGlossaryImportCard catalog={catalog} turmaId={turmaId ?? null} />
      <GlobalImportAiSection {...props} />
    </div>
  );
}
