import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { previewFolderGlossarySync, readFolderGlossarySyncStatus, syncFolderGlossary, type FolderGlossarySyncReport } from "@/features/study/lib/folderGlossaryApi";
import { ACCOUNT_GLOSSARY_QUERY_KEY } from "@/hooks/useAccountGlossary";

interface Props {
  folderId: string;
  folderTitle?: string;
  label?: string;
  compact?: boolean;
  className?: string;
  stopPropagation?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
}

export function FolderGlossarySyncDialog({ folderId, folderTitle, label = "Sincronizar glossário", compact = false, className, stopPropagation = false, variant = "outline" }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initialStatus = readFolderGlossarySyncStatus(folderId);
  const [includeCards, setIncludeCards] = useState(initialStatus.includeNormalCards);
  const [busy, setBusy] = useState<"preview" | "sync" | null>(null);
  const [result, setResult] = useState<FolderGlossarySyncReport | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(initialStatus.lastSyncedAt);

  const run = async (dryRun: boolean) => {
    setBusy(dryRun ? "preview" : "sync");
    try {
      const next = dryRun
        ? await previewFolderGlossarySync(folderId, includeCards)
        : await syncFolderGlossary(folderId, includeCards);
      setResult(next);
      if (!dryRun) {
        setLastSyncedAt(next.syncedAt);
        await queryClient.invalidateQueries({ queryKey: ACCOUNT_GLOSSARY_QUERY_KEY });
        toast.success(`${next.inserted} entrada(s) adicionada(s); ${next.skipped} já existiam.`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível sincronizar a pasta.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant={variant} size={compact ? "icon" : "sm"} className={className} title={label} onClick={(event) => { if (stopPropagation) event.stopPropagation(); }}>
          <RefreshCw className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />
          {!compact && label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Sincronizar com a Caixa de Glossário</DialogTitle>
          <DialogDescription>{folderTitle ? `${folderTitle}. ` : ""}A caixa continua universal; esta ação apenas adiciona entradas encontradas na pasta.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {lastSyncedAt && <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">Sincronizada</Badge><span>Última vez: {new Date(lastSyncedAt).toLocaleString("pt-BR")}</span></div>}

          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox id={`folder-cards-${folderId}`} checked={includeCards} onCheckedChange={(value) => { setIncludeCards(Boolean(value)); setResult(null); }} />
            <div>
              <Label htmlFor={`folder-cards-${folderId}`}>Também usar cards normais</Label>
              <p className="text-xs text-muted-foreground">Desligado usa somente vocabulário estruturado. Ligado transforma frente e verso em termo e tradução.</p>
            </div>
          </div>

          {result && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Listas" value={result.listsScanned} />
                <Metric label="Cards" value={result.cardsScanned} />
                <Metric label="Entradas" value={result.entriesFound} />
                <Metric label={result.dryRun ? "Novas" : "Adicionadas"} value={result.inserted} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{result.exactExisting} já existente(s)</Badge>
                <Badge variant="outline">{result.alternativeLayers} alternativa(s)</Badge>
              </div>
              {result.entriesFound === 0 && !includeCards && <p className="text-sm text-muted-foreground">Nenhuma entrada estruturada encontrada. Ative a opção de cards normais.</p>}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="ghost" onClick={() => navigate(`/glossary?folder=${folderId}`)}><BookOpen className="mr-2 h-4 w-4" />Ver glossário</Button>
          <Button type="button" variant="outline" onClick={() => void run(true)} disabled={Boolean(busy)}>{busy === "preview" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Analisar</Button>
          <Button type="button" onClick={() => void run(false)} disabled={Boolean(busy) || Boolean(result && result.entriesFound === 0)}>{busy === "sync" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Sincronizar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded bg-muted p-2"><p className="font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}
