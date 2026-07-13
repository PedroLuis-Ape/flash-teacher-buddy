import { useState } from "react";
import { AlertCircle, BrainCircuit, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFolderGlossary } from "@/hooks/useFolderGlossary";
import { loadFolderGlossary } from "@/features/study/lib/folderGlossaryApi";
import { loadFolderGlossaryCoverage, type FolderGlossaryCoverageReport } from "@/features/study/lib/folderGlossaryCoverage";
import type { FolderGlossaryEntry, FolderGlossaryInput } from "@/features/study/lib/folderGlossaryTypes";
import { FolderGlossarySemanticReview } from "./FolderGlossarySemanticReview";

interface Props {
  folderId: string;
  folderTitle: string;
  labelA: string;
  labelB: string;
}

export function FolderGlossarySemanticReviewCard({
  folderId,
  folderTitle,
  labelA,
  labelB,
}: Props) {
  const { canEdit, importEntries } = useFolderGlossary(folderId);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<FolderGlossaryCoverageReport | null>(null);
  const [glossary, setGlossary] = useState<FolderGlossaryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadSemanticContext = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const latest = await loadFolderGlossary(folderId);
      const nextReport = await loadFolderGlossaryCoverage(folderId, latest.entries);
      setGlossary(latest.entries);
      setReport(nextReport);
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : "Não foi possível preparar a revisão semântica.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !report && !loading) void loadSemanticContext();
  };

  const handleImportEntries = async (entries: FolderGlossaryInput[]) => {
    await importEntries.mutateAsync({ entries, mode: "merge" });
    await loadSemanticContext();
  };

  if (!canEdit) return null;

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
          <div className="min-w-0">
            <p className="font-medium">Auditar qualidade semântica</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Revise contexto, gramática, flexão, naturalidade, falsos cognatos e conflitos de sentido antes de aplicar correções ao glossário.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => handleOpenChange(true)}
        >
          <BrainCircuit className="mr-2 h-4 w-4" />
          Revisar traduções
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-6xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Qualidade semântica — {folderTitle}</DialogTitle>
            <DialogDescription>
              Processo independente por exportação e importação de JSON. Nenhuma IA externa é chamada automaticamente e nenhuma tradução é gravada apenas ao importar o arquivo.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <p>Preparando palavras, expressões e exemplos para a revisão...</p>
              </div>
            ) : error ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">A revisão não pôde ser preparada</p>
                  <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                </div>
                <Button variant="outline" onClick={() => void loadSemanticContext()}>
                  <RefreshCw className="mr-2 h-4 w-4" />Tentar novamente
                </Button>
              </div>
            ) : report ? (
              <FolderGlossarySemanticReview
                folderId={folderId}
                folderTitle={folderTitle}
                labelA={labelA}
                labelB={labelB}
                report={report}
                glossary={glossary}
                isImporting={importEntries.isPending}
                onImportEntries={handleImportEntries}
              />
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
