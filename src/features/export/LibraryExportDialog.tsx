import { useState } from "react";
import { Copy, Download, FileJson, Library, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { downloadExportFile } from "./folderExport";
import { buildLibraryExport, type LibraryExportResult } from "./libraryExport";

interface LibraryExportDialogProps {
  userId?: string | null;
  className?: string;
  label?: string;
}

export function LibraryExportDialog({
  userId,
  className,
  label = "Exportar biblioteca inteira",
}: LibraryExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LibraryExportResult | null>(null);

  const loadExport = async () => {
    if (loading || !userId) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await buildLibraryExport(userId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível exportar a biblioteca.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !result && !loading) void loadExport();
  };

  const downloadJson = () => {
    if (!result?.jsonText) return;
    downloadExportFile(result.jsonText, `${result.fileBaseName}.json`, "application/json");
    toast.success("Biblioteca exportada em JSON.");
  };

  const downloadTxt = () => {
    if (!result?.plainText) return;
    downloadExportFile(result.plainText, `${result.fileBaseName}.txt`, "text/plain");
    toast.success("Biblioteca exportada em TXT.");
  };

  const copyJson = async () => {
    if (!result?.jsonText) return;
    try {
      await navigator.clipboard.writeText(result.jsonText);
      toast.success("JSON copiado.");
    } catch {
      toast.error("Não foi possível copiar o conteúdo.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={className ?? "min-h-[40px]"}
          title={label}
          aria-label={label}
          data-testid="library-export-action"
        >
          <Library className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col ape-overlay-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            Exportar biblioteca inteira
          </DialogTitle>
          <DialogDescription>
            Todas as suas pastas, listas e flashcards pessoais em um único arquivo, sem resumo e sem remover repetições.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>Lendo toda a sua biblioteca...</p>
            </div>
          ) : error ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={() => void loadExport()}>
                <RefreshCw className="mr-2 h-4 w-4" />Tentar novamente
              </Button>
            </div>
          ) : result ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{result.summary.folders} pasta(s)</Badge>
                <Badge variant="secondary">{result.summary.lists} lista(s)</Badge>
                <Badge variant="secondary">{result.summary.cards} card(s)</Badge>
                {result.summary.layerCards > 0 && (
                  <Badge variant="outline">{result.summary.layerCards} card(s) em camadas</Badge>
                )}
                {result.summary.emptyLists > 0 && (
                  <Badge variant="outline">{result.summary.emptyLists} lista(s) vazia(s)</Badge>
                )}
              </div>
              <Textarea
                value={result.jsonText}
                readOnly
                className="h-[34vh] min-h-[220px] resize-none font-mono text-xs"
                aria-label="Conteúdo JSON da biblioteca exportada"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 pb-[max(.75rem,env(safe-area-inset-bottom,0px))] sm:flex-row">
          <Button variant="outline" className="min-h-11 touch-manipulation" onClick={() => setOpen(false)}>Fechar</Button>
          <Button variant="outline" className="min-h-11 touch-manipulation" onClick={copyJson} disabled={!result?.jsonText || loading}>
            <Copy className="mr-2 h-4 w-4" />Copiar JSON
          </Button>
          <Button variant="secondary" className="min-h-11 touch-manipulation" onClick={downloadTxt} disabled={!result?.plainText || loading}>
            <Download className="mr-2 h-4 w-4" />Baixar TXT
          </Button>
          <Button className="min-h-11 touch-manipulation" onClick={downloadJson} disabled={!result?.jsonText || loading}>
            <FileJson className="mr-2 h-4 w-4" />Baixar JSON
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
