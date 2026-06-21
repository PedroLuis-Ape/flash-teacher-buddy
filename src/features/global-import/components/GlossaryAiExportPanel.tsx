import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Loader2, Search, Sparkles } from "lucide-react";
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
  const folderKey = useMemo(() => [...folderIds].sort().join("|"), [folderIds]);
  const folderSet = useMemo(() => new Set(folderIds), [folderIds]);
  const lists = useMemo(() => (catalog?.lists ?? []).filter((list) => folderSet.has(list.folder_id)), [catalog, folderSet]);
  const listMap = useMemo(() => new Map((catalog?.lists ?? []).map((list) => [list.id, list])), [catalog]);
  const folderMap = useMemo(() => new Map((catalog?.folders ?? []).map((folder) => [folder.id, folder])), [catalog]);

  useEffect(() => { setCards([]); setSelected(new Set()); setSearch(""); }, [folderKey]);

  const filtered = useMemo(() => filterGlossarySourceCards(cards, search), [cards, search]);
  const chosen = useMemo(() => cards.filter((card) => selected.has(card.id)), [cards, selected]);
  const prompt = useMemo(() => buildGlossaryAiPrompt(chosen, side), [chosen, side]);
  const allFiltered = filtered.length > 0 && filtered.every((card) => selected.has(card.id));

  const load = async () => {
    if (folderIds.length === 0) return toast.error("Selecione pelo menos uma pasta.");
    if (lists.length === 0) return toast.error("As pastas selecionadas não possuem listas.");
    setLoading(true);
    try {
      const rows = await loadGlossarySourceCards(lists.map((list) => list.id));
      const enriched = rows.map((card) => {
        const list = listMap.get(card.list_id);
        const folder = list ? folderMap.get(list.folder_id) : undefined;
        return { ...card, list_title: list?.title, folder_title: folder?.title };
      });
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
    const url = URL.createObjectURL(new Blob([prompt], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `app-piteco-prompt-glossario-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <div className="space-y-5">
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div>
        <div className="font-medium">Gerar glossário com IA</div>
        <p className="mt-1 text-sm text-muted-foreground">Carregue os cards, escolha todos ou apenas os desejados e copie o prompt padronizado.</p>
      </div></div>
    </div>

    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1.5"><Label>Conteúdo usado pela IA</Label>
        <Select value={side} onValueChange={(value) => setSide(value as GlossarySourceSide)}>
          <SelectTrigger className="w-full md:w-64"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="both">Lados A e B</SelectItem><SelectItem value="A">Somente lado A</SelectItem><SelectItem value="B">Somente lado B</SelectItem></SelectContent>
        </Select>
      </div>
      <Button onClick={() => void load()} disabled={loading || folderIds.length === 0}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Carregar termos</Button>
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
      <div className="space-y-2"><Label>Prompt pronto para copiar</Label><Textarea value={prompt} readOnly className="min-h-[320px] font-mono text-xs sm:text-sm" /></div>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => void copy()} disabled={chosen.length === 0}><Copy className="mr-2 h-4 w-4" />Copiar prompt</Button><Button onClick={download} disabled={chosen.length === 0}><Download className="mr-2 h-4 w-4" />Baixar prompt</Button></div>
    </>}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-background p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-bold">{value.toLocaleString("pt-BR")}</div></div>;
}
