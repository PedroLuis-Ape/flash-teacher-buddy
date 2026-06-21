import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, ChevronDown, ChevronUp, FileUp, FolderOpen, Library, Loader2, Sparkles } from "lucide-react";
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
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<BulkGlossaryReport | null>(null);
  const [report, setReport] = useState<BulkGlossaryReport | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseGlossaryTransfer(raw, "A"), [raw]);
  const folderIds = useMemo(() => Array.from(selectedFolders), [selectedFolders]);
  const folders = useMemo(() => (catalog?.folders ?? []).filter((folder) =>
    (catalog?.lists ?? []).some((list) => list.folder_id === folder.id),
  ), [catalog]);

  const request = () => ({ folderIds, entries: parsed.entries, turmaId: turmaId ?? null });

  const validate = () => {
    if (parsed.errors.length > 0) {
      toast.error(parsed.errors[0]);
      return false;
    }
    if (parsed.entries.length === 0) {
      toast.error("Envie um glossário válido.");
      return false;
    }
    return true;
  };

  const analyze = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const result = await previewBulkGlossaryImport(request());
      setPreview(result);
      setReport(null);
      toast.success("Prévia calculada sem alterar sua caixa.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível analisar.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const result = await applyBulkGlossaryImport(request(), true);
      setPreview(result);
      setReport(result);
      await queryClient.invalidateQueries({ queryKey: ["account-glossary"] });
      toast.success("Caixa de glossário atualizada.");
    } catch (error: any) {
      toast.error(error?.message || "A importação falhou.");
    } finally {
      setBusy(false);
    }
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("O arquivo excede 25 MB.");
      return;
    }
    setRaw(await file.text());
    setPreview(null);
    setReport(null);
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
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">Caixa de Glossário</h2><Badge variant="secondary">uma por conta</Badge><Badge variant="outline">cards futuros</Badge></div>
        <p className="mt-1 text-sm text-muted-foreground">Cada termo é salvo uma única vez e passa a funcionar automaticamente em todas as listas.</p>
      </div>
      {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
    </button>

    {expanded && <div className="mt-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3"><Library className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-medium">Biblioteca central da conta</p><p className="text-sm text-muted-foreground">Não existem mais cópias por lista. Entradas iguais são ignoradas e traduções diferentes continuam como camadas.</p></div></div>
        <Button variant="outline" onClick={() => navigate("/glossary")}>Abrir minha caixa</Button>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-1">
        <Button variant={mode === "import" ? "default" : "ghost"} onClick={() => setMode("import")}>Importar JSON</Button>
        <Button variant={mode === "export" ? "default" : "ghost"} onClick={() => setMode("export")}>Gerar com IA</Button>
      </div>

      {mode === "import" ? <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><Label>app-piteco-glossario.json</Label><Button asChild size="sm" variant="outline"><label className="cursor-pointer"><FileUp className="mr-1 h-4 w-4" />Arquivo<input className="hidden" type="file" accept=".json,.txt,application/json,text/plain" onChange={(event) => void readFile(event.target.files?.[0])} /></label></Button></div>
        <Textarea value={raw} onChange={(event) => { setRaw(event.target.value); setPreview(null); setReport(null); }} placeholder="Cole o JSON devolvido pela IA" className="min-h-[280px] font-mono text-xs" />
        {parsed.errors.slice(0, 6).map((message) => <p key={message} className="text-sm text-destructive">{message}</p>)}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Termos" value={parsed.entries.length} /><Metric label="Novos" value={preview?.inserted ?? 0} /><Metric label="Existentes" value={preview?.exact_existing ?? 0} /><Metric label="Camadas" value={preview?.alternative_layers ?? 0} /></div>
        {preview && <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">Serão criados no máximo {preview.inserted.toLocaleString("pt-BR")} registros centrais. O número de listas não multiplica mais a quantidade.</p>}
        {report?.success && <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /><p className="text-sm">{report.inserted} adicionada(s); {report.skipped} já existente(s). Todas as listas atuais e futuras usam esta caixa.</p></div>}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => void analyze()} disabled={busy}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}Analisar</Button><Button onClick={() => void apply()} disabled={busy || !preview}>Salvar na caixa central</Button></div>
      </div> : <div className="space-y-4">
        <div className="space-y-2"><div className="flex items-center justify-between"><Label>Pastas usadas como fonte</Label><Button size="sm" variant="ghost" onClick={() => setSelectedFolders(selectedFolders.size === folders.length ? new Set() : new Set(folders.map((folder) => folder.id)))}>{selectedFolders.size === folders.length && folders.length > 0 ? "Limpar" : "Selecionar todas"}</Button></div>
          <div className="grid max-h-[240px] gap-2 overflow-y-auto rounded-lg border p-2 md:grid-cols-2">{folders.map((folder) => <label key={folder.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50"><Checkbox checked={selectedFolders.has(folder.id)} onCheckedChange={() => toggleFolder(folder.id)} /><FolderOpen className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{folder.title}</span></label>)}</div>
        </div>
        <GlossaryAiExportPanel catalog={catalog} folderIds={folderIds} />
      </div>}
    </div>}
  </Card>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value.toLocaleString("pt-BR")}</p></div>;
}
