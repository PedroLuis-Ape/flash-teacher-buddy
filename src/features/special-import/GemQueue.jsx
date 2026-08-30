import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  FileJson,
  FileText,
  Gem,
  MoreHorizontal,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useRemoveSpecialFlashcards, useSpecialFlashcardsDetails } from "@/hooks/useSpecialFlashcards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import ImportExplanationsDialog from "@/components/ImportExplanationsDialog";
import SpecialExportDialog from "./components/SpecialExportDialog";
import SpecialFocusEditorDialog from "./components/SpecialFocusEditorDialog";
import { copyText } from "./lib/protocolPolicy";
import {
  buildAttentionPointAiText,
  buildAttentionPointContextText,
  buildAttentionPointJson,
  buildAttentionPointWordsText,
} from "./lib/attentionPointExport";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 100;
const FOCUS_TAG_LABELS = {
  grammar: "Gramática",
  vocabulary: "Vocabulário",
  expression: "Expressão",
  phrasal_verb: "Phrasal verb",
  pronunciation: "Pronúncia",
  translation: "Tradução",
  natural_usage: "Uso natural",
  other: "Outro",
};

function hasFocusContext(card) {
  return Boolean(card.focus_text || card.focus_tag || card.focus_note || card.notes);
}

function focusTagLabel(tag) {
  return FOCUS_TAG_LABELS[tag] || tag;
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function GemQueue() {
  const navigate = useNavigate();
  const { userId, isLoading: authLoading } = useAuthUser();
  const [selected, setSelected] = useState(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCards, setExportCards] = useState([]);
  const [editingCard, setEditingCard] = useState(null);
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState("all");
  const [focusFilter, setFocusFilter] = useState("all");
  const [focusTagFilter, setFocusTagFilter] = useState("all");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [expandedId, setExpandedId] = useState(null);
  const query = useSpecialFlashcardsDetails(userId);
  const removeMutation = useRemoveSpecialFlashcards();
  const cards = query.data || [];

  useEffect(() => {
    if (!authLoading && !userId) navigate("/auth", { replace: true });
  }, [authLoading, navigate, userId]);

  useEffect(() => {
    const valid = new Set(cards.map((card) => card.flashcard_id));
    setSelected((previous) => new Set([...previous].filter((id) => valid.has(id))));
  }, [cards]);

  useEffect(() => setVisibleLimit(PAGE_SIZE), [focusFilter, focusTagFilter, listFilter, search]);

  const listOptions = useMemo(() => Array.from(new Set(cards
    .map((card) => card.list_title)
    .filter(Boolean))).sort((left, right) => left.localeCompare(right)), [cards]);
  const filteredCards = useMemo(() => {
    const needle = normalize(search.trim());
    return cards.filter((card) => {
      if (listFilter !== "all" && card.list_title !== listFilter) return false;
      const focused = hasFocusContext(card);
      if (focusFilter === "with" && !focused) return false;
      if (focusFilter === "without" && focused) return false;
      if (focusTagFilter !== "all" && card.focus_tag !== focusTagFilter) return false;
      if (!needle) return true;
      return [card.term, card.translation, card.list_title, card.context_tag, card.focus_text, card.focus_note, card.notes]
        .some((value) => normalize(value).includes(needle));
    });
  }, [cards, focusFilter, focusTagFilter, listFilter, search]);
  const renderedCards = filteredCards.slice(0, visibleLimit);
  const chosen = useMemo(() => cards.filter((card) => selected.has(card.flashcard_id)), [cards, selected]);
  const allFilteredSelected = filteredCards.length > 0 && filteredCards.every((card) => selected.has(card.flashcard_id));
  const filteredSelectedCount = filteredCards.filter((card) => selected.has(card.flashcard_id)).length;
  const partialFiltered = filteredSelectedCount > 0 && !allFilteredSelected;
  const focusedCount = useMemo(() => cards.filter(hasFocusContext).length, [cards]);
  const tagOptions = useMemo(() => Array.from(new Set(cards.map((card) => card.focus_tag).filter(Boolean))), [cards]);

  const toggle = (id) => setSelected((previous) => {
    const next = new Set(previous);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleFiltered = () => setSelected((previous) => {
    const next = new Set(previous);
    if (allFilteredSelected) filteredCards.forEach((card) => next.delete(card.flashcard_id));
    else filteredCards.forEach((card) => next.add(card.flashcard_id));
    return next;
  });

  const exportTarget = (target) => {
    if (!target.length) return toast.error("Nenhum card para exportar.");
    setExportCards(target);
    setExportOpen(true);
  };

  const copyExport = async (target, builder, successMessage) => {
    if (!target.length) return toast.error("Nenhum ponto de atenção para copiar.");
    const copied = await copyText(builder(target));
    if (copied) toast.success(successMessage);
    else toast.error("Não foi possível copiar para a área de transferência.");
  };

  const downloadJson = (target) => {
    if (!target.length) return toast.error("Nenhum ponto de atenção para exportar.");
    const blob = new Blob([buildAttentionPointJson(target)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pontos-de-atencao-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("JSON exportado sem remover os cards.");
  };

  const actionTarget = chosen.length ? chosen : filteredCards;

  const removeCards = async (target) => {
    const ids = Array.from(new Set(target.map((card) => card.flashcard_id)));
    if (!ids.length) return;
    const confirmed = window.confirm(`Remover ${ids.length} ponto(s) de atenção? Nenhum flashcard será apagado.`);
    if (!confirmed) return;
    try {
      await removeMutation.mutateAsync(ids);
      setSelected((previous) => {
        const next = new Set(previous);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(`${ids.length} card(s) removido(s) da fila.`);
    } catch {
      // O hook apresenta a mensagem de erro.
    }
  };

  return <div className="container mx-auto max-w-6xl px-3 py-5 pb-24 sm:px-4 sm:py-8 sm:pb-12">
    <Helmet><title>Pontos de atenção | App Piteco</title></Helmet>

    <div className="mb-4 flex items-center gap-3 sm:mb-6 sm:flex-wrap">
      <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
      <div className="rounded-xl bg-amber-100 p-2.5 dark:bg-amber-950/40"><Gem className="h-6 w-6 text-amber-600" /></div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold sm:text-3xl">Pontos de atenção</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">Reveja palavras e frases que merecem uma explicação extra.</p>
      </div>
      <Badge variant="secondary" className="hidden sm:inline-flex">{cards.length} item(s)</Badge>
      <Button onClick={() => setImportOpen(true)} size="sm" className="shrink-0"><Upload className="mr-1.5 h-4 w-4" />Importar JSON</Button>
    </div>

    <Card className="mb-4 border-amber-200 bg-gradient-to-br from-amber-50 via-background to-sky-50 p-3 dark:border-amber-900 dark:from-amber-950/20 dark:to-sky-950/20 sm:mb-6 sm:p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold">Organize antes de pedir ajuda à IA</p>
          <p className="mt-1 text-muted-foreground">Selecione itens, copie o contexto necessário e mantenha os pontos na fila até decidir removê-los.</p>
          <p className="mt-2 text-xs text-muted-foreground">{focusedCount} de {cards.length} item(s) possuem foco pedagógico definido.</p>
        </div>
      </div>
    </Card>

    {authLoading || query.isLoading ? <LoadingSpinner message="Carregando pontos de atenção..." /> : !cards.length ? <Card className="p-10 text-center">
      <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
      <div className="font-semibold">A fila está vazia</div>
      <p className="mt-1 text-sm text-muted-foreground">Marque uma dificuldade durante um estudo de escrita para ela aparecer aqui.</p>
    </Card> : <>
      <Card className="mb-3 p-3 sm:mb-4 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar termo, tradução, lista ou foco..." className="pl-9" />
          </div>
          <Select value={listFilter} onValueChange={setListFilter}>
            <SelectTrigger><SelectValue placeholder="Todas as listas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as listas</SelectItem>
              {listOptions.map((title) => <SelectItem key={title} value={title}>{title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={focusFilter} onValueChange={setFocusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Com e sem foco</SelectItem>
              <SelectItem value="with">Somente com foco</SelectItem>
              <SelectItem value="without">Somente sem foco</SelectItem>
            </SelectContent>
          </Select>
          <Select value={focusTagFilter} onValueChange={setFocusTagFilter}>
            <SelectTrigger><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {tagOptions.map((tag) => <SelectItem key={tag} value={tag}>{focusTagLabel(tag)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{filteredCards.length} resultado(s)</span>
          {(search || listFilter !== "all" || focusFilter !== "all" || focusTagFilter !== "all") && <Button variant="ghost" size="sm" className="h-7" onClick={() => { setSearch(""); setListFilter("all"); setFocusFilter("all"); setFocusTagFilter("all"); }}>Limpar filtros</Button>}
        </div>
      </Card>

      <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2.5 shadow-sm backdrop-blur sm:mb-4 sm:p-3">
        <Checkbox checked={allFilteredSelected ? true : partialFiltered ? "indeterminate" : false} onCheckedChange={toggleFiltered} aria-label="Selecionar resultados filtrados" />
        <span className="mr-auto text-sm font-medium">{selected.size} selecionado(s) · {filteredSelectedCount} neste filtro</span>
        <Button variant="outline" size="sm" onClick={() => void removeCards(chosen)} disabled={!chosen.length || removeMutation.isPending}>
          <Trash2 className="mr-1 h-4 w-4" />Remover
        </Button>
        <Button
          size="sm"
          onClick={() => void copyExport(actionTarget, buildAttentionPointAiText, "Pontos de atenção copiados para a IA.")}
          disabled={!actionTarget.length}
        >
          <Clipboard className="mr-1 h-4 w-4" />Copiar para IA
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Mais ações de exportação">
              <MoreHorizontal className="mr-1 h-4 w-4" />Mais ações
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void copyExport(actionTarget, buildAttentionPointWordsText, "Palavras copiadas.")}>
              <Clipboard className="mr-2 h-4 w-4" />Copiar somente palavras
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void copyExport(actionTarget, buildAttentionPointContextText, "Contexto copiado.")}>
              <Clipboard className="mr-2 h-4 w-4" />Copiar com contexto
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => downloadJson(actionTarget)}>
              <FileJson className="mr-2 h-4 w-4" />Exportar JSON
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportTarget(actionTarget)}>
              <FileText className="mr-2 h-4 w-4" />Abrir exportador TXT oficial
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!filteredCards.length ? <Card className="p-8 text-center">
        <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <div className="font-medium">Nenhum ponto de atenção corresponde aos filtros</div>
        <Button variant="link" onClick={() => { setSearch(""); setListFilter("all"); setFocusFilter("all"); setFocusTagFilter("all"); }}>Limpar filtros</Button>
      </Card> : <div className="space-y-3">
        {renderedCards.map((card) => {
          const hasFocus = hasFocusContext(card);
          const expanded = expandedId === card.id;
          return <Card key={card.id} className={`p-3 transition sm:p-4 ${selected.has(card.flashcard_id) ? "border-primary/50 bg-primary/5" : "hover:border-primary/30"}`}>
            <div className="flex items-start gap-3">
              <Checkbox checked={selected.has(card.flashcard_id)} onCheckedChange={() => toggle(card.flashcard_id)} className="mt-1" aria-label={`Selecionar ${card.term}`} />
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => setExpandedId(expanded ? null : card.id)} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                <div className="space-y-1">
                  <div className="break-words text-sm font-semibold sm:text-base">{card.term}</div>
                  <div className="break-words text-sm text-muted-foreground">→ {card.translation}</div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                  {card.list_title && <Badge variant="secondary" className="max-w-full truncate">{card.list_title}</Badge>}
                  {card.context_tag && <Badge variant="outline" className="max-w-full truncate">{card.context_tag}</Badge>}
                  {card.layer_index != null && <Badge variant="outline">Camada {card.layer_index + 1}</Badge>}
                  {hasFocus && <Badge variant="outline" className="border-primary/30 text-primary">Ponto definido</Badge>}
                </div>
                </button>

                {expanded && (hasFocus ? <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs sm:p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-primary">Ponto de atenção</span>
                    {card.focus_tag && <Badge variant="secondary" className="text-[11px]">{focusTagLabel(card.focus_tag)}</Badge>}
                    {card.focus_side && <Badge variant="outline" className="text-[11px]">Lado {card.focus_side === "a" ? "A" : card.focus_side === "b" ? "B" : "A e B"}</Badge>}
                  </div>
                  {card.focus_text && <div className="break-words"><span className="font-medium text-muted-foreground">Trecho: </span><span className="font-semibold text-foreground">{card.focus_text}</span></div>}
                  {(card.focus_note || card.notes) && <div className="mt-1 break-words text-muted-foreground"><span className="font-medium">Orientação: </span>{card.focus_note || card.notes}</div>}
                </div> : <div className="mt-3 rounded-lg border border-dashed bg-muted/30 p-2 text-xs text-muted-foreground">Sem foco específico. Edite o ponto para orientar a IA com mais precisão.</div>)}

                {expanded && card.hint && <p className="mt-2 break-words text-xs text-muted-foreground">Dica: {card.hint}</p>}
                {!expanded && hasFocus && card.focus_text && <p className="mt-2 truncate text-xs text-muted-foreground">Trecho marcado: <span className="font-medium text-foreground">{card.focus_text}</span></p>}
                <p className="mt-2 text-[11px] text-muted-foreground">{expanded ? "Toque no resumo para recolher" : "Toque para ver o ponto completo"}</p>
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditingCard(card)} title="Editar ponto de atenção" aria-label={`Editar ponto de atenção de ${card.term}`}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => void removeCards([card])} title="Remover da fila" aria-label={`Remover ${card.term} da fila`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          </Card>;
        })}

        {renderedCards.length < filteredCards.length && <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => setVisibleLimit((value) => value + PAGE_SIZE)}>Carregar mais {Math.min(PAGE_SIZE, filteredCards.length - renderedCards.length)}</Button>
        </div>}
      </div>}
    </>}

    <SpecialExportDialog open={exportOpen} onOpenChange={setExportOpen} cards={exportCards} />
    <ImportExplanationsDialog open={importOpen} onOpenChange={setImportOpen} userId={userId} />
    <SpecialFocusEditorDialog card={editingCard} userId={userId} open={Boolean(editingCard)} onOpenChange={(open) => !open && setEditingCard(null)} />
  </div>;
}
