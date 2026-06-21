import { useMemo, useState } from "react";
import { BookOpen, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { parseGlossaryTransfer } from "@/features/study/lib/glossaryTransfer";
import type { ImportDestinationCatalog } from "../destination";
import { importGlossaryToFolders, type BulkGlossaryImportReport } from "../bulkGlossaryService";

interface Props {
  catalog: ImportDestinationCatalog | null;
  turmaId?: string | null;
}

export function BulkGlossaryImportCard({ catalog, turmaId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [raw, setRaw] = useState("");
  const [defaultSide, setDefaultSide] = useState<"A" | "B">("A");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<BulkGlossaryImportReport | null>(null);

  const parsed = useMemo(() => parseGlossaryTransfer(raw, defaultSide), [raw, defaultSide]);
  const listCountByFolder = useMemo(() => {
    const result = new Map<string, number>();
    for (const list of catalog?.lists ?? []) result.set(list.folder_id, (result.get(list.folder_id) ?? 0) + 1);
    return result;
  }, [catalog]);
  const targetedLists = [...selected].reduce((sum, id) => sum + (listCountByFolder.get(id) ?? 0), 0);
  const allSelected = Boolean(catalog?.folders.length) && selected.size === catalog?.folders.length;

  const toggleFolder = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setReport(null);
  };

  const toggleAll = () => {
    if (!catalog) return;
    setSelected(allSelected ? new Set() : new Set(catalog.folders.map((folder) => folder.id)));
    setReport(null);
  };

  const run = async () => {
    if (parsed.errors.length) return toast.error(parsed.errors[0]);
    if (!parsed.entries.length) return toast.error("Adicione ao menos uma entrada de glossário.");
    if (!selected.size || targetedLists === 0) return toast.error("Selecione uma pasta com listas.");
    setBusy(true);
    setReport(null);
    try {
      const input = { folderIds: [...selected], entries: parsed.entries, turmaId };
      const preview = await importGlossaryToFolders({ ...input, confirmExisting: false });
      if (preview.requires_confirmation && !window.confirm(`${preview.skipped_exact} idêntica(s) serão ignoradas; ${preview.updated} atualizadas; ${preview.added_as_layer} adicionadas como camadas. Continuar?`)) {
        setReport(preview);
        return;
      }
      const applied = await importGlossaryToFolders({ ...input, confirmExisting: true });
      setReport(applied);
      toast.success(`Glossário aplicado em ${applied.lists_targeted} lista(s).`);
    } catch (error: any) {
      toast.error(error?.message || "Falha ao importar o glossário.");
    } finally {
      setBusy(false);
    }
  };

  return <Card className="overflow-hidden">
    <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center gap-3 p-5 text-left">
      <BookOpen className="h-5 w-5 text-primary" />
      <span className="flex-1"><strong className="block">Glossário em massa</strong><span className="text-sm text-muted-foreground">Aplique um único glossário a todas as listas das pastas escolhidas.</span></span>
      <span className="text-sm text-muted-foreground">{expanded ? "Fechar" : "Abrir"}</span>
    </button>
    {expanded && <div className="space-y-5 border-t p-5">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">Entradas idênticas são ignoradas. Mudanças de nota ou ativação são atualizadas. Traduções diferentes para o mesmo termo permanecem como camadas.</div>
      <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
        <div><Label htmlFor="bulk-glossary">Glossário</Label><Textarea id="bulk-glossary" value={raw} onChange={(event) => setRaw(event.target.value)} rows={9} className="mt-2 font-mono text-sm" placeholder={"=== GLOSSÁRIO GLOBAL ===\nI / eu\nam / sou, estou\n=== CARDS ==="} /></div>
        <div className="space-y-3"><div><Label>Lado padrão</Label><Select value={defaultSide} onValueChange={(value) => setDefaultSide(value as "A" | "B")}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A">Lado A</SelectItem><SelectItem value="B">Lado B</SelectItem></SelectContent></Select></div><div className="rounded-lg bg-muted p-3 text-sm"><div><strong>{parsed.entries.length}</strong> termo(s)</div><div><strong>{targetedLists}</strong> lista(s)</div><div><strong>{parsed.entries.length * targetedLists}</strong> aplicação(ões)</div></div></div>
      </div>
      {parsed.errors.length > 0 && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{parsed.errors[0]}</div>}
      <div className="space-y-3"><div className="flex items-center justify-between gap-2"><div><Label>Pastas de destino</Label><p className="text-xs text-muted-foreground">Todas as listas existentes serão incluídas.</p></div><Button variant="outline" size="sm" onClick={toggleAll}><CheckSquare className="mr-1.5 h-4 w-4" />{allSelected ? "Desmarcar todas" : "Marcar todas"}</Button></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(catalog?.folders ?? []).map((folder) => <label key={folder.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/50"><Checkbox checked={selected.has(folder.id)} onCheckedChange={() => toggleFolder(folder.id)} className="mt-0.5" /><span className="min-w-0"><strong className="block truncate text-sm">{folder.title}</strong><span className="text-xs text-muted-foreground">{listCountByFolder.get(folder.id) ?? 0} lista(s)</span></span></label>)}</div></div>
      {report && <div className="rounded-lg border bg-muted/40 p-3 text-sm">{report.inserted} nova(s), {report.updated} atualizada(s), {report.skipped_exact} idêntica(s) ignorada(s), {report.added_as_layer} camada(s).</div>}
      <div className="flex justify-end"><Button onClick={run} disabled={busy || !parsed.entries.length || !selected.size || parsed.errors.length > 0}>{busy ? "Importando..." : `Aplicar em ${targetedLists} lista(s)`}</Button></div>
    </div>}
  </Card>;
}
