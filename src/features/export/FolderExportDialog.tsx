import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, FileJson, FileText, FolderArchive, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  buildFolderExport,
  downloadExportFile,
  type FolderExportResult,
  type FolderExportSource,
} from './folderExport';

interface FolderExportDialogProps {
  sources: FolderExportSource[];
  packageName?: string;
  label?: string;
  compact?: boolean;
  className?: string;
  stopPropagation?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function FolderExportDialog({
  sources,
  packageName,
  label = 'Exportar pasta',
  compact = false,
  className,
  stopPropagation = false,
  variant = 'outline',
  size = 'sm',
}: FolderExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'json'>('text');
  const [result, setResult] = useState<FolderExportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceKey = useMemo(
    () => sources.map((source) => source.id).filter(Boolean).sort().join('|'),
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
      if (!next.jsonText) setActiveTab('text');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível exportar as pastas.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !result && !loading) void loadExport();
  };

  const currentText = activeTab === 'json' ? result?.jsonText ?? '' : result?.plainText ?? '';

  const copyCurrent = async () => {
    if (!currentText) return;
    try {
      await navigator.clipboard.writeText(currentText);
      toast.success(activeTab === 'json' ? 'JSON copiado!' : 'Conteúdo da pasta copiado!');
    } catch {
      toast.error('Não foi possível copiar o conteúdo.');
    }
  };

  const downloadText = () => {
    if (!result?.plainText) return;
    downloadExportFile(result.plainText, `${result.fileBaseName}.txt`, 'text/plain');
    toast.success('Arquivo TXT exportado!');
  };

  const downloadJson = () => {
    if (!result?.jsonText) return;
    downloadExportFile(result.jsonText, `${result.fileBaseName}.json`, 'application/json');
    toast.success('Pacote JSON exportado!');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={compact ? 'icon' : size}
          className={className}
          onClick={(event) => {
            if (stopPropagation) event.stopPropagation();
          }}
          title={label}
          aria-label={label}
        >
          <FolderArchive className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
          {!compact && label}
        </Button>
      </DialogTrigger>

      <DialogContent
        className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col"
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

        {loading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p>Carregando listas e cards...</p>
          </div>
        ) : error ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="font-medium text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void loadExport()}>
              <RefreshCw className="mr-2 h-4 w-4" />Tentar novamente
            </Button>
          </div>
        ) : result ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-hidden">
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
                Listas vazias aparecem no TXT, mas não entram no JSON do Super Importador porque o contrato exige pelo menos um card por lista.
              </p>
            )}

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'text' | 'json')} className="flex min-h-0 flex-1 flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">
                  <FileText className="mr-2 h-4 w-4" />Texto copiável
                </TabsTrigger>
                <TabsTrigger value="json" disabled={!result.jsonText}>
                  <FileJson className="mr-2 h-4 w-4" />JSON para importar
                </TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="min-h-0 flex-1">
                <Textarea
                  value={result.plainText}
                  readOnly
                  className="h-[42vh] min-h-[260px] resize-none font-mono text-xs"
                />
              </TabsContent>
              <TabsContent value="json" className="min-h-0 flex-1">
                <Textarea
                  value={result.jsonText}
                  readOnly
                  className="h-[42vh] min-h-[260px] resize-none font-mono text-xs"
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : null}

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
