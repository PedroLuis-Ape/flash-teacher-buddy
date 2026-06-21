import { useEffect, useMemo, useState } from "react";
import { Copy, Download, FileDown, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ImportDestinationCatalog } from "../destination";
import {
  addGlossaryWordInventory,
  buildGlossaryAiPrompt,
  buildGlossaryAiPromptHeader,
  buildGlossaryAiPromptParts,
  buildGlossaryAiSourceChunk,
  buildGlossaryWordInventorySection,
  filterGlossarySourceCards,
  GLOSSARY_AI_SOURCE_FOOTER,
  type GlossarySourceCard,
  type GlossarySourceSide,
  type GlossaryWordInventoryItem,
} from "../glossaryAiExport";
import { loadGlossarySourceCards, streamGlossarySourceCards } from "../glossaryAiExportService";

interface Props { catalog: ImportDestinationCatalog | null; folderIds: string[]; }
const DISPLAY_LIMIT = 300;
const CLIPBOARD_CARD_LIMIT = 5000;

export function GlossaryAiExportPanel({ catalog, folderIds }: Props) {
  const [cards, setCards] = useState<GlossarySourceCard[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [side, setSide] = useState<GlossarySourceSide>("both");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [lastExportCount, setLastExportCount] = useState(0);
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
    setLastExportCount(0);
  }, [folderKey]);

  const filtered = useMemo(() => filterGlossarySourceCards(cards, search), [cards, search]);
  const allFiltered = useMemo(
    () => filtered.length > 0 && filtered.every((card) => selected.has(card.id)),
    [filtered, selected],
  );

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

  const downloadBlob = (parts: BlobPart[], filename: string) => {
    const url = URL.createObjectURL(new Blob(parts, { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportAll = async () => {
    if (!validateFolders()) return;
    setExportingAll(true);
    setLoadedCount(0);
    setLastExportCount(0);

    try {
      const parts: BlobPart[] = [buildGlossaryAiPromptHeader(side)];
      const inventory = new Map<string, GlossaryWordInventoryItem>();
      let cardOffset = 0;

      const total = await streamGlossarySourceCards(
        lists.map((list) => list.id),
        (batch, loadedCards) => {
          const enrichedBatch = enrich(batch);
          parts.push(buildGlossaryAiSourceChunk(enrichedBatch, side, cardOffset));
          addGlossaryWordInventory(enrichedBatch, side, inventory);
          cardOffset += enrichedBatch.length;
          setLoadedCount(loadedCards);
        },
      );

      if (total === 0) {
        toast.error("Nenhum card foi encontrado nas pastas selecionadas.");
        return;
      }

      parts.push(`${GLOSSARY_AI_SOURCE_FOOTER}\n`);
      parts.push(buildGlossaryWordInventorySection(inventory.values()));
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(parts, `app-piteco-instrucoes-glossario-${date}.txt`);
      setLastExportCount(total);
      toast.success(`${total.toLocaleString("pt-BR")} card(s) exportado(s), com ${inventory.size.toLocaleString("pt-BR")} palavra(s) única(s) obrigatórias.`);
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
      toast.success(`${enriched.length.toLocaleString("pt-BR")} card(s) carregado(s) para seleção manual.`);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível carregar os termos.");
    } finally {
      setLoading(false);
    }
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

  const selectedCards = () => cards.filter((card) => selected.has(card.id));

  const copy = async () => {
    if (selected.size === 0) return toast.error("Selecione pelo menos um card.");
    if (selected.size > CLIPBOARD_CARD_LIMIT) {
      toast.error(`Para mais de ${CLIPBOARD_CARD_LIMIT.toLocaleString("pt-BR")} cards, use “Baixar seleção” para evitar travar o navegador.`);
      return;
    }
    await navigator.clipboard.writeText(buildGlossaryAiPrompt(selectedCards(), side));
    toast.success("Prompt copiado. A resposta obrigatória é um arquivo JSON.");
  };

  const download = () => {
    if (selected.size === 0) return toast.error("Selecione pelo menos um card.");
    const chosen = selectedCards();
    downloadBlob(
      buildGlossaryAiPromptParts(chosen, side),
      `app-piteco-instrucoes-glossario-selecao-${new Date().toISOString().slice(0, 10)}.txt`,
    );
    toast.success(`${chosen.length.toLocaleString("pt-BR")} card(s) incluído(s) no arquivo da seleção.`);
  };

  return <div className="space-y-5">
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div>
        <div className="flex flex-wrap items-center gap-2"><span className="font-medium">Gerar glossário com IA</span><Badge variant="secondary">retorno obrigatório: JSON</Badge><Badge variant="outline">alta capacidade</Badge></div>
        <p className="mt-1 text-sm text-muted-foreground">A exportação inclui cada palavra única uma vez e pede chunks adicionais. Uma palavra repetida em muitos cards não é duplicada no glossário.</p>
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
      {(loading || exportingAll) && <p className="text-sm text-muted-foreground">Processando por lotes: {loadedCount.toLocaleString("pt-BR")} card(s)...</p>}
      {lastExportCount > 0 && !exportingAll && <p className="text-sm font-medium text-emerald-600">Última exportação concluída: {lastExportCount.toLocaleString("pt-BR")} cards.</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">Para volumes muito grandes, use “Exportar tudo para IA”. O arquivo inclui um inventário obrigatório para impedir que a IA omita palavras comuns como the, at, of ou is.</p>
    </div>

    {cards.length > 0 && <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Cards carregados" value={cards.length} /><Metric label="Selecionados" value={selected.size} /><Metric label="Pastas" value={folderIds.length} /><Metric label="Listas" value={lists.length} /></div>
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
        {filtered.length > DISPLAY_LIMIT && <p className="text-xs text-muted-foreground">Mostrando somente {DISPLAY_LIMIT} de {filtered.length.toLocaleString("pt-BR")} resultados na tela. A exportação continua incluindo todos os selecionados.</p>}
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">Palavras individuais e chunks são camadas cumulativas. O prompt completo é montado somente ao copiar ou baixar.</div>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => void copy()} disabled={selected.size === 0}><Copy className="mr-2 h-4 w-4" />Copiar seleção</Button><Button onClick={download} disabled={selected.size === 0}><Download className="mr-2 h-4 w-4" />Baixar seleção</Button></div>
    </>}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-background p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-bold">{value.toLocaleString("pt-BR")}</div></div>;
}
