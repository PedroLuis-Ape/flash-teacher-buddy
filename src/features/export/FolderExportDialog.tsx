import { useEffect, useMemo, useState } from "react";
import { Copy, Download, FileJson, FileText, FolderArchive, Loader2, RefreshCw } from "lucide-react";
import { ZodError } from "zod";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FolderExportHistoryPanel } from "./FolderExportHistoryPanel";
import {
  clearFolderExportHistory,
  readFolderExportHistory,
  recordFolderExport,
  type FolderExportFormat,
} from "./folderExportHistory";
import {
  buildFolderExport,
  downloadExportFile,
  type FolderExportResult,
  type FolderExportSource,
} from "./folderExport";

interface FolderExportDialogProps {
  sources: FolderExportSource[];
  packageName?: string;
  label?: string;
  compact?: boolean;
  className?: string;
  stopPropagation?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

function issueLocation(path: PropertyKey[]): string {
  const numberAfter = (key: string) => {
    const index = path.indexOf(key);
    const value = index >= 0 ? path[index + 1] : undefined;
    return typeof value === "number" ? value + 1 : null;
  };

  const folder = numberAfter("folders");
  const list = numberAfter("lists");
  const card = numberAfter("cards");
  const layer = numberAfter("layers");
  const parts = [
    folder ? `pasta ${folder}` : null,
    list ? `lista ${list}` : null,
    card ? `card ${card}` : null,
    layer ? `camada ${layer}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? ` Local: ${parts.join(", ")}.` : "";
}

function friendlyExportError(cause: unknown): string {
  if (cause instanceof ZodError) {
    const issue = cause.issues[0];
    return `Não foi possível preparar o JSON. ${issue?.message ?? "Há um conteúdo incompatível."}${issue ? issueLocation(issue.path) : ""}`;
  }
  return cause instanceof Error
    ? cause.message
    : "Não foi possível exportar as pastas.";
}

export function FolderExportDialog({
  sources,
  packageName,
  label = "Exportar pasta",
  compact = false,
  className,
  stopPropagation = false,
  variant = "outline",
  size = "sm",
}: FolderExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"text" | "json">("text");
  const [result, setResult] = useState<FolderExportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState(() => readFolderExportHistory());
  const sourceKey = useMemo(
    () => sources.map((source) => source.id).filter(Boolean).sort().join("|"),
    [sources],
  );
  const sourceNames = useMemo(
    () => sources.map((source) => source.title?.trim() || "Pasta sem nome"),
    [sources],
  );

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [sourceKey, packageName]);

  const loadExport = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const next = await buildFolderExport(sources, packageName);
      setResult(next);
      if (!next.jsonText) setActiveTab("text");
    } catch (cause) {
      setError(friendlyExportError(cause));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setHistory(readFolderExportHistory());
      if (!result && !loading) void loadExport();
    }
  };

  const remember = (format: FolderExportFormat, fileName: string) => {
    if (!result) return;
    setHistory(recordFolderExport({
      format,
      fileName,
      sources,
      summary: result.summary,
    }));
  };

  const currentText = activeTab === "json" ? result?.jsonText ?? "" : result?.plainText ?? "";

  const copyCurrent = async () => {
    if (!currentText || !result) return;
    try {
      await navigator.clipboard.writeText(currentText);
      const isJson = activeTab === "json";
      remember(isJson ? "copy-json" : "copy-txt", `${result.fileBaseName}.${isJson ? "json" : "txt"}`);
      toast.success(isJson ? "JSON copiado e registrado no histórico." : "Conteúdo copiado e registrado no histórico.");
    } catch {
      toast.error("Não foi possível copiar o conteúdo.");
    }
  };

  const downloadText = () => {
    if (!result?.plainText) return;
    const fileName = `${result.fileBaseName}.txt`;
    downloadExportFile(result.plainText, fileName, "text/plain");
    remember("txt", fileName);
    toast.success("Arquivo TXT exportado e registrado no histórico.");
  };

  const downloadJson = () => {
    if (!result?.jsonText) return;
    const fileName = `${result.fileBaseName}.json`;
    downloadExportFile(result.jsonText, fileName, "application/json");
    remember("json", fileName);
    toast.success("Pacote JSON exportado e registrado no histórico.");
  };

  const clearHistory = () => {
    clearFolderExportHistory();
    setHistory([]);
    toast.success("Histórico de exportações limpo.");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={compact ? "icon" : size}
          className={className}
          onClick={(event) => {
            if (stopPropagation) event.stopPropagation();
          }}
          title={label}
          aria-label={label}
        >
          <FolderArchive className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />
          {!compact && label}
        </Button>
      </DialogTrigger>

      <DialogContent
        className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-3xl flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderArchive className="h-5 w-5 text-primary" />
            Exportar pasta completa
          </DialogTitle>
          <DialogDescription>
            Todas as listas e todos os cards acessíveis serão reunidos em um único pacote.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="rounded-xl border bg-muted/20 p-3 text-sm">
            <p className="font-medium">Pastas incluídas nesta exportação</p>
            <p className="mt-1 break-words text-muted-foreground">{sourceNames.join(", ")}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              O pacote 2.0 preserva campos de card com até 250.000 caracteres e arquivos de até 50 MB.
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>Carregando listas e cards...</p>
            </div>
          ) : error ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
              <div>
                <p className="font-semibold text-destructive">Não foi possível preparar a exportação</p>
                <p className="mt-2 text-sm text-destructive/90">{error}</p>
              </div>
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
                {result.summary.layeredGroups > 0 && (
                  <Badge variant="outline">{result.summary.layeredGroups} grupo(s) em camadas</Badge>
                )}
                {result.summary.emptyLists > 0 && (
                  <Badge variant="outline">{result.summary.emptyLists} lista(s) vazia(s)</Badge>
                )}
              </div>

              {result.summary.emptyLists > 0 && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
                  Listas vazias aparecem no TXT, mas não entram no JSON porque o contrato exige pelo menos um card por lista.
                </p>
              )}

              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "text" | "json")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text">
                    <FileText className="mr-2 h-4 w-4" />Texto copiável
                  </TabsTrigger>
                  <TabsTrigger value="json" disabled={!result.jsonText}>
                    <FileJson className="mr-2 h-4 w-4" />JSON para importar
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="text">
                  <Textarea
                    value={result.plainText}
                    readOnly
                    className="h-[34vh] min-h-[220px] resize-none font-mono text-xs"
                  />
                </TabsContent>
                <TabsContent value="json">
                  <Textarea
                    value={result.jsonText}
                    readOnly
                    className="h-[34vh] min-h-[220px] resize-none font-mono text-xs"
                  />
                </TabsContent>
              </Tabs>
            </div>
          ) : null}

          <FolderExportHistoryPanel entries={history} onClear={clearHistory} />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          <Button variant="outline" onClick={copyCurrent} disabled={!currentText || loading}>
            <Copy className="mr-2 h-4 w-4" />Copiar
          </Button>
          <Button variant="secondary" onClick={downloadText} disabled={!result?.plainText || loading}>
            <Download className="mr-2 h-4 w-4" />Baixar TXT
          </Button>
          <Button onClick={downloadJson} disabled={!result?.jsonText || loading}>
            <FileJson className="mr-2 h-4 w-4" />Baixar JSON
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
