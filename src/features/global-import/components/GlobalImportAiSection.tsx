import type { GlobalImportDestinationMode } from "../destinationModes";
import { buildUniversalGlobalImportPrompt } from "../universalPrompt";
import { PrimaryPromptCard } from "./PrimaryPromptCard";
import { PromptBuilderCard } from "./PromptBuilderCard";

interface Props {
  mode: GlobalImportDestinationMode;
  destinationFolderName?: string;
}

export function GlobalImportAiSection({ mode, destinationFolderName }: Props) {
  return (
    <div className="space-y-4">
      <PrimaryPromptCard prompt={buildUniversalGlobalImportPrompt()} />
      <details className="rounded-xl border bg-card">
        <summary className="cursor-pointer select-none p-4 font-medium">Modo avançado opcional</summary>
        <div className="border-t p-3">
          <p className="mb-3 px-2 text-sm text-muted-foreground">
            Use o formulário manual somente quando quiser definir tecnicamente nomes, estrutura e quantidades.
          </p>
          <PromptBuilderCard mode={mode} destinationFolderName={destinationFolderName} />
        </div>
      </details>
    </div>
  );
}
