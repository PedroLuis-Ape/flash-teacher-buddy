import { useEffect, useMemo, useState } from "react";
import { Copy, Download, FileDown, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ImportDestinationCatalog } from "../destination";
import { buildGlossaryAiPrompt, filterGlossarySourceCards, type GlossarySourceCard, type GlossarySourceSide } from "../glossaryAiExport";
import { loadGlossarySourceCards } from "../glossaryAiExportService";

interface Props { catalog: ImportDestinationCatalog | null; folderIds: string[]; }
const DISPLAY_LIMIT = 300;

export function GlossaryAiExportPanel({ catalog, folderIds }: Props) {
  const [cards, setCards] = useState<GlossarySourceCard[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [side, setSide] = useState<GlossarySourceSide>("both");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const folderKey = useMemo(() => [...folderIds].sort().join("|"), [folderIds]);
  const folderSet = useMemo(() => new Set(folderIds), [folderIds]);
  const lists = useMemo(() => (catalog?.lists ?? []).filter((list) => folderSet.has(list.folder_id)), [catalog, folderSet]);
  const listMap = useMemo(() => new Map((catalog?.lists ?? []).map((list) => [list.id, list])), [catalog]);
  const folderMap = useMemo(() => new Map((catalog?.folders ?? []).map((folder) => [folder.id, folder])), [catalog]);

  useEffect(() => {
    setCards([]);
    setSelected(new Set());
    setSearch("");
    setLoadedCount(0);
  }, [folderKey]);

  const filtered = useMemo(() => filterGlossarySourceCards(cards, search), [cards, search]);
  const chosen = useMemo(() => cards.filter((card) => selected.has(card.id)), [cards, selected]);
  const prompt = useMemo(() => buildGlossaryAiPrompt(chosen, side), [chosen, side]);
  const allFiltered = filtered.length > 0 && filtered.every((card) => selected.has(card.id));

  const enrich = (rows: GlossarySourceCard[]) => rows.map((card) => {
    const list = listMap.get(card.list_id);
    const folder = list ? folderMap.get(list.folder_id) : undefined;
    return { ...card, list_title: list?.title, folder_title: folder?.title };
  });

  const validateFolders = () => {
    if (folderIds.length === 0) {
      toast.error("Selecione pelo menos uma pasta.");
      return false;
    }
    if (lists.length === 0) {
      toast.error("As pastas selecionadas não possuem listas.");
      return false;
    }
    return true;
  };

  const downloadText = (content: string, filename: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportAll = async () => {
    if (!validateFolders()) return;
    setExportingAll(true);
    setLoadedCount(0);
    try {
      const rows = await loadGlossarySourceCards(lists.map((list) => list.id), setLoadedCount);
      const allCards = enrich(rows);
      if (allCards.length === 0) {
        toast.error("Nenhum card foi encontrado nas pastas selecionadas.");
        return;
      }
      const completePrompt = buildGlossaryAiPrompt(allCards, side);
      const date = new Date().toISOString().slice(0, 10);
      downloadText(completePrompt, `app-piteco-todos-os-termos-${date}.txt`);
      setCards(allCards);
      setSelected(new Set(allCards.map((card) => card.id)));
      toast.success(`${allCards.length.toLocaleString("pt-BR")} card(s) exportado(s) em um único arquivo.`);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível exportar todos os termos.");
    } finally {
      setExportingAll(false);
    }
  };

  const load = async () => {
    if (!validateFolders()) return;
    setLoading(true);
    setLoadedCount(0);
    try {
      const rows = await loadGlossarySourceCards(lists.map((list) => list.id), setLoadedCount);
      const enriched = enrich(rows);
      setCards(enriched);
      setSelected(new Set(enriched.map((card) => card.id)));
      toast.success(`${enriched.length.toLocaleString("pt-BR")} card(s) carregado(s).`);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível carregar os termos.");
    } finally { setLoading(false); }
  };

  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleFiltered = () => setSelected((current) => {
    const next = new Set(current);
    filtered.forEach((card) => { if (allFiltered) next.delete(card.id); else next.add(card.id); });
    return next;
  });

  const copy = async () => {
    if (chosen.length === 0) return toast.error("Selecione pelo menos um card.");
    await navigator.clipboard.writeText(prompt);
    toast.success("Prompt completo copiado.");
  };

  const download = () => {
    if (chosen.length === 0) return toast.error("Selecione pelo menos um card.");
    downloadText(prompt, `app-piteco-prompt-glossario-${new Date().toISOString().slice(0, 10)}.txt`);
  };

  return <div className="space-y-5">
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div>
        <div className="font-medium">Gerar glossário com IA</div>
        <p className="mt-1 text-sm text-muted-foreground">Depois de marcar as pastas, exporte todos os cards em um único arquivo para enviar ao ChatGPT. O arquivo já contém o prompt e o contrato de resposta do App Piteco.</p>
      </div></div>
    </div>

    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5"><Label>Conteúdo usado pela IA</Label>
          <Select value={side} onValueChange={(value) => setSide(value as GlossarySourceSide)}>
            <SelectTrigger className="w-full md:w-64"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="both">Lados A e B</SelectItem><SelectItem value="A">Somente lado A</SelectItem><SelectItem value="B">Somente lado B</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading || exportingAll || folderIds.length === 0}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Carregar para escolher</Button>
          <Button onClick={() => void exportAll()} disabled={loading || exportingAll || folderIds.length === 0}>{exportingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}Exportar tudo para IA</Button>
        </div>
      </div>
      {(loading || exportingAll) && <p className="text-sm text-muted-foreground">Lendo todos os cards, sem limite artificial: {loadedCount.toLocaleString("pt-BR")} carregado(s)...</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">“Exportar tudo para IA” não exige seleção manual: reúne todos os cards de todas as listas das pastas marcadas, mesmo que o arquivo fique muito longo.</p>
    </div>

    {cards.length > 0 && <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Cards" value={cards.length} /><Metric label="Selecionados" value={chosen.length} /><Metric label="Pastas" value={folderIds.length} /><Metric label="Listas" value={lists.length} /></div>
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="relative flex-1 sm:max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar termo, tradução, lista ou pasta..." className="pl-9" /></div>
          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={toggleFiltered}>{allFiltered ? "Desmarcar resultados" : "Selecionar resultados"}</Button><Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar</Button></div>
        </div>
        <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-lg border p-2">
          {filtered.slice(0, DISPLAY_LIMIT).map((card) => <label key={card.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50">
            <Checkbox checked={selected.has(card.id)} onCheckedChange={() => toggle(card.id)} className="mt-1" />
            <div className="min-w-0 flex-1"><div className="break-words text-sm font-medium">{card.term || "—"}</div><div className="mt-0.5 break-words text-sm text-primary">{card.translation || "—"}</div><div className="mt-1 flex flex-wrap gap-1">{card.folder_title && <Badge variant="outline" className="text-[10px]">{card.folder_title}</Badge>}{card.list_title && <Badge variant="secondary" className="text-[10px]">{card.list_title}</Badge>}</div></div>
          </label>)}
          {filtered.length === 0 && <div className="p-5 text-center text-sm text-muted-foreground">Nenhum termo encontrado.</div>}
        </div>
        {filtered.length > DISPLAY_LIMIT && <p className="text-xs text-muted-foreground">Mostrando {DISPLAY_LIMIT} de {filtered.length.toLocaleString("pt-BR")} resultados. Refine a busca para localizar termos específicos.</p>}
      </div>
      <div className="space-y-2"><Label>Prompt da seleção atual</Label><Textarea value={prompt} readOnly className="min-h-[320px] font-mono text-xs sm:text-sm" /></div>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => void copy()} disabled={chosen.length === 0}><Copy className="mr-2 h-4 w-4" />Copiar seleção</Button><Button onClick={download} disabled={chosen.length === 0}><Download className="mr-2 h-4 w-4" />Baixar seleção</Button></div>
    </>}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-background p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-bold">{value.toLocaleString("pt-BR")}</div></div>;
}
