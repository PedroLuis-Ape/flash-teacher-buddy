import { useMemo, useState } from "react";
import { BookOpen, CheckCircle2, ChevronDown, ChevronUp, FileUp, FolderOpen, Loader2, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { parseGlossaryTransfer } from "@/features/study/lib/glossaryTransfer";
import type { ImportDestinationCatalog } from "../destination";
import { folderListCount, glossaryApplicationsCount, type BulkGlossaryReport } from "../bulkGlossary";
import { applyBulkGlossaryImport, previewBulkGlossaryImport } from "../bulkGlossaryService";
import { GlossaryAiExportPanel } from "./GlossaryAiExportPanel";

interface Props {
  catalog: ImportDestinationCatalog | null;
  turmaId?: string | null;
}

const EXAMPLE = `=== GLOSSÁRIO GLOBAL ===
[A] I / eu
[A] am / sou, estou
[A] because of / por causa de
=== CARDS ===`;

export function BulkGlossaryImportPanel({ catalog, turmaId }: Props) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMode, setActiveMode] = useState<"import" | "export">("import");
  const [raw, setRaw] = useState("");
  const [defaultSide, setDefaultSide] = useState<"A" | "B">("A");
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<BulkGlossaryReport | null>(null);
  const [report, setReport] = useState<BulkGlossaryReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const parsed = useMemo(() => parseGlossaryTransfer(raw, defaultSide), [raw, defaultSide]);
  const selectedIds = useMemo(() => Array.from(selectedFolderIds), [selectedFolderIds]);
  const targetLists = folderListCount(catalog, selectedIds);
  const applications = glossaryApplicationsCount(parsed.entries.length, targetLists);
  const selectableFolders = useMemo(() => (catalog?.folders ?? []).filter((folder) => (
    (catalog?.lists ?? []).some((list) => list.folder_id === folder.id)
  )), [catalog]);

  const resetAnalysis = () => {
    setPreview(null);
    setReport(null);
  };

  const updateRaw = (value: string) => {
    setRaw(value);
    resetAnalysis();
  };

  const toggleFolder = (folderId: string) => {
    setSelectedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
    resetAnalysis();
  };

  const toggleAll = () => {
    setSelectedFolderIds((current) => (
      current.size === selectableFolders.length
        ? new Set()
        : new Set(selectableFolders.map((folder) => folder.id))
    ));
    resetAnalysis();
  };

  const request = () => ({ folderIds: selectedIds, entries: parsed.entries, turmaId: turmaId ?? null });

  const validateInput = () => {
    if (parsed.errors.length > 0) {
      toast.error(parsed.errors[0]);
      return false;
    }
    if (parsed.entries.length === 0) {
      toast.error("Cole ou envie pelo menos uma entrada de glossário.");
      return false;
    }
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos uma pasta.");
      return false;
    }
    if (targetLists === 0) {
      toast.error("As pastas selecionadas não possuem listas.");
      return false;
    }
    return true;
  };

  const analyze = async () => {
    if (!validateInput()) return;
    setBusy(true);
    setReport(null);
    try {
      const result = await previewBulkGlossaryImport(request());
      setPreview(result);
      toast.success("Prévia calculada. Nenhuma lista foi alterada.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível analisar o glossário.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async (confirmExisting: boolean) => {
    if (!validateInput()) return;
    setConfirmOpen(false);
    setBusy(true);
    try {
      const result = await applyBulkGlossaryImport(request(), confirmExisting);
      if (result.requires_confirmation && !confirmExisting) {
        setPreview(result);
        setConfirmOpen(true);
        return;
      }
      setReport(result);
      setPreview(result);
      await queryClient.invalidateQueries({ queryKey: ["list-glossary"] });
      toast.success(`Glossário aplicado em ${result.target_lists} lista(s).`);
    } catch (error: any) {
      toast.error(error?.message || "A importação falhou e nenhuma alteração foi concluída.");
    } finally {
      setBusy(false);
    }
  };

  const startImport = () => {
    if (!preview) {
      toast.error("Analise a importação antes de confirmar.");
      return;
    }
    if (preview.exact_existing > 0) setConfirmOpen(true);
    else void apply(false);
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("O arquivo de glossário excede 5 MB.");
      return;
    }
    try {
      updateRaw(await file.text());
      toast.success(`${file.name} carregado.`);
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  };

  return (
    <>
      <Card className="p-5">
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          className="flex w-full items-start gap-3 text-left"
          aria-expanded={isExpanded}
        >
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">Glossário em massa</h2>
              <Badge variant="secondary">importar e gerar com IA</Badge>
              {selectedFolderIds.size > 0 && <Badge variant="outline">{selectedFolderIds.size} pasta(s)</Badge>}
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Importe um glossário para várias listas ou gere um prompt a partir dos cards. O reconhecimento funciona nos lados A e B.
            </p>
          </div>
          {isExpanded ? <ChevronUp className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" /> : <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />}
        </button>

        <div className={isExpanded ? "mt-5 space-y-6" : "hidden"}>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-1">
            <Button type="button" variant={activeMode === "import" ? "default" : "ghost"} onClick={() => setActiveMode("import")}>Importar glossário</Button>
            <Button type="button" variant={activeMode === "export" ? "default" : "ghost"} onClick={() => setActiveMode("export")}>Gerar com IA</Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Pastas usadas nesta operação</Label>
              <Button type="button" size="sm" variant="ghost" onClick={toggleAll} disabled={selectableFolders.length === 0}>
                {selectedFolderIds.size === selectableFolders.length && selectableFolders.length > 0 ? "Limpar" : "Selecionar todas"}
              </Button>
            </div>
            <div className="grid max-h-[260px] gap-2 overflow-y-auto rounded-lg border p-2 md:grid-cols-2">
              {catalog === null ? (
                <div className="p-4 text-center text-sm text-muted-foreground md:col-span-2">Carregando pastas...</div>
              ) : catalog.folders.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground md:col-span-2">Nenhuma pasta disponível.</div>
              ) : catalog.folders.map((folder) => {
                const listCount = catalog.lists.filter((list) => list.folder_id === folder.id).length;
                const disabled = listCount === 0;
                return (
                  <label key={folder.id} className={`flex items-center gap-3 rounded-md border p-3 ${disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:bg-muted/50"}`}>
                    <Checkbox checked={selectedFolderIds.has(folder.id)} disabled={disabled} onCheckedChange={() => toggleFolder(folder.id)} />
                    <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{folder.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{listCount} lista(s)</span>
                  </label>
                );
              })}
            </div>
          </div>

          {activeMode === "import" ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="bulk-glossary-source">Conteúdo do glossário</Label>
                  <div className="flex items-center gap-2">
                    <Select value={defaultSide} onValueChange={(value) => { setDefaultSide(value as "A" | "B"); resetAnalysis(); }}>
                      <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="A">Termos no lado A</SelectItem><SelectItem value="B">Termos no lado B</SelectItem></SelectContent>
                    </Select>
                    <Button asChild size="sm" variant="outline">
                      <label className="cursor-pointer"><FileUp className="mr-1.5 h-4 w-4" />Arquivo<input className="hidden" type="file" accept=".txt,.json,text/plain,application/json" onChange={(event) => void readFile(event.target.files?.[0])} /></label>
                    </Button>
                  </div>
                </div>
                <Textarea id="bulk-glossary-source" value={raw} onChange={(event) => updateRaw(event.target.value)} placeholder={EXAMPLE} className="min-h-[260px] font-mono text-sm" />
                {parsed.errors.length > 0 && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{parsed.errors.slice(0, 4).map((error) => <div key={error}>{error}</div>)}</div>}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Termos únicos" value={parsed.entries.length} />
                <Metric label="Pastas" value={selectedFolderIds.size} />
                <Metric label="Listas alcançadas" value={targetLists} />
                <Metric label="Aplicações previstas" value={applications} />
              </div>

              {preview && <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4 text-primary" />Prévia inteligente</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Novas entradas" value={preview.inserted} /><Metric label="Idênticas ignoradas" value={preview.exact_existing} /><Metric label="Novas camadas" value={preview.alternative_layers} /><Metric label="Listas" value={preview.target_lists} /></div>
                {preview.exact_existing > 0 && <p className="text-sm text-muted-foreground">Entradas idênticas serão ignoradas. Traduções diferentes serão preservadas como novas camadas. Nenhuma entrada existente será alterada.</p>}
              </div>}

              {report && report.success && !report.dry_run && <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /><div><div className="font-medium">Glossário distribuído com sucesso</div><p className="text-sm text-muted-foreground">{report.inserted} adicionada(s) e {report.skipped} já existente(s) ignorada(s) em {report.target_lists} lista(s).</p></div></div>}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => void analyze()} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Analisar sem alterar</Button>
                <Button onClick={startImport} disabled={busy || !preview}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Aplicar a todas as listas</Button>
              </div>
            </div>
          ) : <GlossaryAiExportPanel catalog={catalog} folderIds={selectedIds} />}
        </div>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Parte deste glossário já existe</AlertDialogTitle><AlertDialogDescription>{preview?.exact_existing ?? 0} ocorrência(s) idêntica(s) foram encontradas. Elas serão ignoradas, enquanto traduções diferentes continuarão como novas camadas. Nenhuma entrada existente será modificada. Deseja continuar?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Voltar e revisar</AlertDialogCancel><AlertDialogAction onClick={() => void apply(true)}>Continuar com segurança</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-background p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-bold">{value.toLocaleString("pt-BR")}</div></div>;
}
