import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileJson,
  FileText,
  Gem,
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
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
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

  useEffect(() => setVisibleLimit(PAGE_SIZE), [focusFilter, listFilter, search]);

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
      if (!needle) return true;
      return [card.term, card.translation, card.list_title, card.context_tag, card.focus_text, card.focus_note, card.notes]
        .some((value) => normalize(value).includes(needle));
    });
  }, [cards, focusFilter, listFilter, search]);
  const renderedCards = filteredCards.slice(0, visibleLimit);
  const chosen = useMemo(() => cards.filter((card) => selected.has(card.flashcard_id)), [cards, selected]);
  const allFilteredSelected = filteredCards.length > 0 && filteredCards.every((card) => selected.has(card.flashcard_id));
  const filteredSelectedCount = filteredCards.filter((card) => selected.has(card.flashcard_id)).length;
  const partialFiltered = filteredSelectedCount > 0 && !allFilteredSelected;
  const focusedCount = useMemo(() => cards.filter(hasFocusContext).length, [cards]);

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

  const removeCards = async (target) => {
    const ids = Array.from(new Set(target.map((card) => card.flashcard_id)));
    if (!ids.length) return;
    const confirmed = window.confirm(`Remover ${ids.length} card(s) da fila de Especiais? Nenhum flashcard será apagado.`);
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
    <Helmet><title>Cards Especiais | App Piteco</title></Helmet>

    <div className="mb-4 flex items-center gap-3 sm:mb-6 sm:flex-wrap">
      <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
      <div className="rounded-xl bg-sky-100 p-2.5 dark:bg-sky-950/40"><Gem className="h-6 w-6 text-sky-600" /></div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold sm:text-3xl">Central de Cards Especiais</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">Organize a fila, exporte TXT e importe o JSON da IA</p>
      </div>
      <Badge variant="secondary" className="hidden sm:inline-flex">{cards.length} na fila</Badge>
      <Button onClick={() => setImportOpen(true)} size="sm" className="shrink-0"><Upload className="mr-1.5 h-4 w-4" />Importar JSON</Button>
    </div>

    <Card className="mb-4 border-sky-200 bg-gradient-to-br from-sky-50 via-background to-violet-50 p-3 dark:border-sky-900 dark:from-sky-950/20 dark:to-violet-950/20 sm:mb-6 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-5 w-5 text-sky-600" />Fluxo oficial de ponta a ponta</div>
        <Badge variant="outline">TXT → IA → JSON v3</Badge>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-4 sm:gap-3">
        <div className="rounded-lg bg-background/80 p-2.5 sm:p-3"><b>1. Organize</b><p className="mt-1 text-xs text-muted-foreground">Busque, filtre e ajuste o foco.</p></div>
        <div className="rounded-lg bg-background/80 p-2.5 sm:p-3"><b>2. Exporte TXT</b><p className="mt-1 text-xs text-muted-foreground">O prompt e os cards vão juntos.</p></div>
        <div className="rounded-lg bg-background/80 p-2.5 sm:p-3"><b>3. Receba JSON</b><p className="mt-1 text-xs text-muted-foreground">A IA devolve somente o contrato v3.</p></div>
        <div className="rounded-lg bg-background/80 p-2.5 sm:p-3"><b>4. Valide</b><p className="mt-1 text-xs text-muted-foreground">Confira antes de gravar e remover da fila.</p></div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{focusedCount} de {cards.length} card(s) possuem foco pedagógico definido.</p>
    </Card>

    {authLoading || query.isLoading ? <LoadingSpinner message="Carregando especiais..." /> : !cards.length ? <Card className="p-10 text-center">
      <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
      <div className="font-semibold">A fila está vazia</div>
      <p className="mt-1 text-sm text-muted-foreground">Marque um flashcard como especial para ele aparecer aqui.</p>
    </Card> : <>
      <Card className="mb-3 p-3 sm:mb-4 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
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
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{filteredCards.length} resultado(s)</span>
          {(search || listFilter !== "all" || focusFilter !== "all") && <Button variant="ghost" size="sm" className="h-7" onClick={() => { setSearch(""); setListFilter("all"); setFocusFilter("all"); }}>Limpar filtros</Button>}
        </div>
      </Card>

      <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2.5 shadow-sm backdrop-blur sm:mb-4 sm:p-3">
        <Checkbox checked={allFilteredSelected ? true : partialFiltered ? "indeterminate" : false} onCheckedChange={toggleFiltered} aria-label="Selecionar resultados filtrados" />
        <span className="mr-auto text-sm font-medium">{selected.size} selecionado(s) · {filteredSelectedCount} neste filtro</span>
        <Button variant="outline" size="sm" onClick={() => void removeCards(chosen)} disabled={!chosen.length || removeMutation.isPending}>
          <Trash2 className="mr-1 h-4 w-4" />Remover
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportTarget(chosen)} disabled={!chosen.length}>
          <FileText className="mr-1 h-4 w-4" />TXT selecionados
        </Button>
        <Button size="sm" onClick={() => exportTarget(filteredCards)} disabled={!filteredCards.length}><Download className="mr-1 h-4 w-4" />TXT filtrados</Button>
      </div>

      {!filteredCards.length ? <Card className="p-8 text-center">
        <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <div className="font-medium">Nenhum Card Especial corresponde aos filtros</div>
        <Button variant="link" onClick={() => { setSearch(""); setListFilter("all"); setFocusFilter("all"); }}>Limpar filtros</Button>
      </Card> : <div className="space-y-3">
        {renderedCards.map((card) => {
          const hasFocus = hasFocusContext(card);
          return <Card key={card.id} className={`p-3 transition sm:p-4 ${selected.has(card.flashcard_id) ? "border-primary/50 bg-primary/5" : "hover:border-primary/30"}`}>
            <div className="flex items-start gap-3">
              <Checkbox checked={selected.has(card.flashcard_id)} onCheckedChange={() => toggle(card.flashcard_id)} className="mt-1" aria-label={`Selecionar ${card.term}`} />
              <button type="button" onClick={() => toggle(card.flashcard_id)} className="min-w-0 flex-1 text-left">
                <div className="space-y-1">
                  <div className="break-words text-sm font-semibold sm:text-base">{card.term}</div>
                  <div className="break-words text-sm text-muted-foreground">→ {card.translation}</div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                  {card.list_title && <Badge variant="secondary" className="max-w-full truncate">{card.list_title}</Badge>}
                  {card.context_tag && <Badge variant="outline" className="max-w-full truncate">{card.context_tag}</Badge>}
                  {card.layer_index != null && <Badge variant="outline">Camada {card.layer_index + 1}</Badge>}
                </div>

                {hasFocus ? <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs sm:p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-primary">Foco da explicação</span>
                    {card.focus_tag && <Badge variant="secondary" className="text-[11px]">{focusTagLabel(card.focus_tag)}</Badge>}
                  </div>
                  {card.focus_text && <div className="break-words"><span className="font-medium text-muted-foreground">Trecho: </span><span className="font-semibold text-foreground">{card.focus_text}</span></div>}
                  {(card.focus_note || card.notes) && <div className="mt-1 break-words text-muted-foreground"><span className="font-medium">Orientação: </span>{card.focus_note || card.notes}</div>}
                </div> : <div className="mt-3 rounded-lg border border-dashed bg-muted/30 p-2 text-xs text-muted-foreground">Sem foco específico. Edite o foco para orientar a IA com mais precisão.</div>}

                {card.hint && <p className="mt-2 break-words text-xs text-muted-foreground">Dica: {card.hint}</p>}
              </button>

              <div className="flex shrink-0 flex-col gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditingCard(card)} title="Editar foco" aria-label={`Editar foco de ${card.term}`}><Pencil className="h-4 w-4" /></Button>
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
