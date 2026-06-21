import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileJson,
  FileUp,
  FolderOpen,
  Library,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseGlossaryTransfer } from "@/features/study/lib/glossaryTransfer";
import type { ImportDestinationCatalog } from "../destination";
import type { BulkGlossaryReport } from "../bulkGlossary";
import { forceAccountGlossarySync, type AccountGlossarySyncReport } from "../accountGlossarySync";
import { applyBulkGlossaryImport, previewBulkGlossaryImport } from "../bulkGlossaryService";
import { GlossaryAiExportPanel } from "./GlossaryAiExportPanel";

interface Props {
  catalog: ImportDestinationCatalog | null;
  turmaId?: string | null;
}

export function AccountGlossaryImportPanel({ catalog, turmaId }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"import" | "export">("import");
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState("");
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<BulkGlossaryReport | null>(null);
  const [report, setReport] = useState<BulkGlossaryReport | null>(null);
  const [syncReport, setSyncReport] = useState<AccountGlossarySyncReport | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);

  const parsed = useMemo(() => parseGlossaryTransfer(raw, "A"), [raw]);
  const folderIds = useMemo(() => Array.from(selectedFolders), [selectedFolders]);
  const folders = useMemo(() => (catalog?.folders ?? []).filter((folder) =>
    (catalog?.lists ?? []).some((list) => list.folder_id === folder.id),
  ), [catalog]);
  const isValidFile = raw.trim().length > 0 && parsed.entries.length > 0 && parsed.errors.length === 0;

  const request = () => ({ folderIds, entries: parsed.entries, turmaId: turmaId ?? null });

  const validate = () => {
    if (parsed.errors.length > 0) {
      setServiceError(parsed.errors[0]);
      toast.error(parsed.errors[0]);
      return false;
    }
    if (parsed.entries.length === 0) {
      const message = "Selecione um app-piteco-glossario.json válido.";
      setServiceError(message);
      toast.error(message);
      return false;
    }
    return true;
  };

  const analyze = async () => {
    if (!validate()) return;
    setImportBusy(true);
    setServiceError(null);
    try {
      const result = await previewBulkGlossaryImport(request());
      setPreview(result);
      setReport(null);
      toast.success("Arquivo validado e analisado sem alterar sua caixa.");
    } catch (error: any) {
      const message = error?.message || "Não foi possível analisar o glossário.";
      setServiceError(message);
      toast.error(message);
    } finally {
      setImportBusy(false);
    }
  };

  const synchronize = async (showToast = true) => {
    setSyncBusy(true);
    setServiceError(null);
    try {
      const result = await forceAccountGlossarySync(queryClient, catalog?.lists.length ?? 0);
      setSyncReport(result);
      if (showToast) toast.success("Caixa de Glossário sincronizada.");
      return result;
    } catch (error: any) {
      const message = error?.message || "Não foi possível sincronizar o glossário.";
      setServiceError(message);
      if (showToast) toast.error(message);
      return null;
    } finally {
      setSyncBusy(false);
    }
  };

  const apply = async () => {
    if (!validate()) return;
    setImportBusy(true);
    setServiceError(null);
    try {
      const result = await applyBulkGlossaryImport(request(), true);
      setPreview(result);
      setReport(result);
      await queryClient.invalidateQueries({ queryKey: ["account-glossary"] });
      toast.success("Glossário salvo na caixa central.");
      void synchronize(false);
    } catch (error: any) {
      const message = error?.message || "A importação falhou.";
      setServiceError(message);
      toast.error(message);
    } finally {
      setImportBusy(false);
    }
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("O arquivo excede 25 MB.");
      return;
    }
    setFileName(file.name);
    setRaw(await file.text());
    setPreview(null);
    setReport(null);
    setServiceError(null);
  };

  const toggleFolder = (id: string) => {
    setSelectedFolders((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return <Card className="p-5">
    <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-start gap-3 text-left">
      <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">Caixa de Glossário</h2>
          <Badge variant="secondary">uma por conta</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Uma biblioteca central para todas as suas listas atuais e futuras.</p>
      </div>
      {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
    </button>

    {expanded && <div className="mt-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Library className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">Biblioteca central da conta</p>
            <p className="text-sm text-muted-foreground">Cada termo é salvo uma vez. Traduções diferentes permanecem como camadas, sem cópias por lista.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate("/glossary")}>Abrir minha caixa</Button>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-1">
        <Button variant={mode === "import" ? "default" : "ghost"} onClick={() => setMode("import")}>Importar JSON</Button>
        <Button variant={mode === "export" ? "default" : "ghost"} onClick={() => setMode("export")}>Gerar com IA</Button>
      </div>

      {mode === "import" ? <div className="space-y-5">
        <section className="space-y-4 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">1. Selecione o arquivo</p>
              <p className="text-sm text-muted-foreground">Formato oficial: app-piteco-glossario.json</p>
            </div>
            <Button asChild variant="outline">
              <label className="cursor-pointer">
                <FileUp className="mr-2 h-4 w-4" />Selecionar JSON
                <input className="hidden" type="file" accept=".json,application/json" onChange={(event) => void readFile(event.target.files?.[0])} />
              </label>
            </Button>
          </div>

          {raw && <div className={`flex items-start gap-3 rounded-lg border p-3 ${isValidFile ? "border-emerald-500/30 bg-emerald-500/10" : "border-destructive/30 bg-destructive/5"}`}>
            {isValidFile ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />}
            <div className="min-w-0">
              <p className="font-medium">{isValidFile ? "Arquivo validado" : "O arquivo precisa de correção"}</p>
              <p className="break-all text-sm text-muted-foreground">{fileName || "Conteúdo colado"} · {parsed.entries.length.toLocaleString("pt-BR")} entradas reconhecidas</p>
            </div>
          </div>}

          {parsed.errors.slice(0, 6).map((message) => <p key={message} className="text-sm text-destructive">{message}</p>)}

          <details className="rounded-lg border bg-muted/20">
            <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm font-medium">
              <FileJson className="h-4 w-4" />Ver ou colar o conteúdo do arquivo
            </summary>
            <div className="border-t p-3">
              <Textarea
                value={raw}
                onChange={(event) => {
                  setRaw(event.target.value);
                  setFileName("");
                  setPreview(null);
                  setReport(null);
                  setServiceError(null);
                }}
                placeholder="Cole aqui o JSON devolvido pela IA"
                className="min-h-[220px] font-mono text-xs"
              />
            </div>
          </details>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => void analyze()} disabled={importBusy || !isValidFile}>
              {importBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Analisar arquivo
            </Button>
            <Button onClick={() => void apply()} disabled={importBusy || !preview}>
              Importar para minha caixa
            </Button>
          </div>
        </section>

        {preview && <section className="space-y-3 rounded-xl border p-4">
          <p className="font-medium">2. Resultado da análise</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Encontrados" value={preview.glossary_entries} />
            <Metric label="Novos" value={preview.inserted} />
            <Metric label="Existentes" value={preview.exact_existing} />
            <Metric label="Camadas" value={preview.alternative_layers} />
          </div>
          <p className="text-sm text-muted-foreground">O número de listas não multiplica registros. Cada entrada será guardada somente na caixa central.</p>
        </section>}

        {report?.success && <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <p className="text-sm">{report.inserted} adicionada(s); {report.skipped} já existente(s). O glossário já vale para listas e cards futuros.</p>
        </div>}

        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Sincronização das listas</p>
              <p className="text-sm text-muted-foreground">Recarrega a caixa nos caches do aplicativo. Não cria cópias nem altera traduções.</p>
            </div>
            <Button variant="outline" onClick={() => void synchronize()} disabled={syncBusy}>
              {syncBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Forçar sincronização
            </Button>
          </div>
          {syncReport && <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <p><strong>{syncReport.activeEntries.toLocaleString("pt-BR")}</strong> entradas ativas em <strong>{syncReport.listCount.toLocaleString("pt-BR")}</strong> listas.</p>
            <p className="mt-1 text-xs text-muted-foreground">Última sincronização: {new Date(syncReport.syncedAt).toLocaleString("pt-BR")} · Supabase {syncReport.projectRef}</p>
          </div>}
        </section>

        {serviceError && <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{serviceError}</p>
        </div>}
      </div> : <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Pastas usadas somente como fonte de cards</Label>
            <Button size="sm" variant="ghost" onClick={() => setSelectedFolders(selectedFolders.size === folders.length ? new Set() : new Set(folders.map((folder) => folder.id)))}>
              {selectedFolders.size === folders.length && folders.length > 0 ? "Limpar" : "Selecionar todas"}
            </Button>
          </div>
          <div className="grid max-h-[240px] gap-2 overflow-y-auto rounded-lg border p-2 md:grid-cols-2">
            {folders.map((folder) => <label key={folder.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50">
              <Checkbox checked={selectedFolders.has(folder.id)} onCheckedChange={() => toggleFolder(folder.id)} />
              <FolderOpen className="h-4 w-4 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{folder.title}</span>
            </label>)}
          </div>
        </div>
        <GlossaryAiExportPanel catalog={catalog} folderIds={folderIds} />
      </div>}
    </div>}
  </Card>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value.toLocaleString("pt-BR")}</p></div>;
}
