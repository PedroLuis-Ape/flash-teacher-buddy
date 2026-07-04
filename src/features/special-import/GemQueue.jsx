import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Gem, Sparkles, Upload } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useSpecialFlashcardsDetails } from "@/hooks/useSpecialFlashcards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import ImportExplanationsDialog from "@/components/ImportExplanationsDialog";
import SpecialExportDialog from "./components/SpecialExportDialog";

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

export default function GemQueue() {
  const navigate = useNavigate();
  const { userId, isLoading: authLoading } = useAuthUser();
  const [selected, setSelected] = useState(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCards, setExportCards] = useState([]);
  const query = useSpecialFlashcardsDetails(userId);
  const cards = query.data || [];

  useEffect(() => {
    if (!authLoading && !userId) navigate("/auth", { replace: true });
  }, [authLoading, navigate, userId]);

  useEffect(() => {
    const valid = new Set(cards.map((card) => card.flashcard_id));
    setSelected((previous) => new Set([...previous].filter((id) => valid.has(id))));
  }, [cards]);

  const chosen = useMemo(() => cards.filter((card) => selected.has(card.flashcard_id)), [cards, selected]);
  const allSelected = cards.length > 0 && selected.size === cards.length;
  const partial = selected.size > 0 && !allSelected;
  const focusedCount = useMemo(() => cards.filter(hasFocusContext).length, [cards]);

  const toggle = (id) => setSelected((previous) => {
    const next = new Set(previous);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const exportTarget = (target) => {
    if (!target.length) return toast.error("Nenhum card para exportar.");
    setExportCards(target);
    setExportOpen(true);
  };

  return <div className="h-[calc(100dvh-4rem)] min-h-0 overflow-y-auto overscroll-contain">
    <div className="container mx-auto max-w-5xl px-3 py-5 pb-28 sm:px-4 sm:py-8 sm:pb-16">
      <Helmet><title>Cards Especiais | App Piteco</title></Helmet>

      <div className="mb-4 flex items-center gap-3 sm:mb-6 sm:flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
        <div className="rounded-xl bg-sky-100 p-2.5 dark:bg-sky-950/40"><Gem className="h-6 w-6 text-sky-600" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold sm:text-3xl">Cards Especiais</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">Crie explicações detalhadas com IA</p>
        </div>
        <Badge variant="secondary" className="hidden sm:inline-flex">{cards.length} na fila</Badge>
        <Button onClick={() => setImportOpen(true)} size="sm" className="shrink-0"><Upload className="mr-1.5 h-4 w-4" />Importar</Button>
      </div>

      <Card className="mb-4 border-sky-200 bg-gradient-to-br from-sky-50 via-background to-violet-50 p-3 dark:border-sky-900 dark:from-sky-950/20 dark:to-violet-950/20 sm:mb-6 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2 font-semibold sm:mb-3"><Sparkles className="h-5 w-5 text-sky-600" />Fluxo em três passos</div>
        <div className="grid gap-2 text-sm sm:grid-cols-3 sm:gap-3">
          <div className="rounded-lg bg-background/80 p-2.5 sm:p-3"><b>1. Selecione</b><p className="mt-1 text-xs text-muted-foreground">Escolha os cards desejados.</p></div>
          <div className="rounded-lg bg-background/80 p-2.5 sm:p-3"><b>2. Prepare</b><p className="mt-1 text-xs text-muted-foreground">Baixe o CSV e copie o prompt.</p></div>
          <div className="rounded-lg bg-background/80 p-2.5 sm:p-3"><b>3. Importe</b><p className="mt-1 text-xs text-muted-foreground">Aplique o arquivo preenchido.</p></div>
        </div>
        {focusedCount > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {focusedCount} card(s) já têm foco pedagógico salvo para guiar a IA.
          </p>
        )}
      </Card>

      {authLoading || query.isLoading ? <LoadingSpinner message="Carregando especiais..." /> : !cards.length ? <Card className="p-10 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
        <div className="font-semibold">A fila está vazia</div>
        <p className="mt-1 text-sm text-muted-foreground">Marque um flashcard como especial para ele aparecer aqui.</p>
      </Card> : <>
        <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2.5 shadow-sm backdrop-blur sm:mb-4 sm:p-3">
          <Checkbox
            checked={allSelected ? true : partial ? "indeterminate" : false}
            onCheckedChange={() => setSelected(allSelected ? new Set() : new Set(cards.map((card) => card.flashcard_id)))}
          />
          <span className="mr-auto text-sm font-medium">{selected.size} de {cards.length}</span>
          <Button variant="outline" size="sm" onClick={() => exportTarget(chosen)} disabled={!chosen.length}>
            <FileSpreadsheet className="mr-1 h-4 w-4" />Selecionados
          </Button>
          <Button size="sm" onClick={() => exportTarget(cards)}><Download className="mr-1 h-4 w-4" />Todos</Button>
        </div>

        <div className="space-y-3">
          {cards.map((card) => {
            const hasFocus = hasFocusContext(card);
            return <Card key={card.id} className={`p-3 transition sm:p-4 ${selected.has(card.flashcard_id) ? "border-primary/50 bg-primary/5" : "hover:border-primary/30"}`}>
              <div className="flex items-start gap-3">
                <Checkbox checked={selected.has(card.flashcard_id)} onCheckedChange={() => toggle(card.flashcard_id)} className="mt-1" />
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

                  {hasFocus && (
                    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs sm:p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-primary">Foco da explicação</span>
                        {card.focus_tag && <Badge variant="secondary" className="text-[11px]">{focusTagLabel(card.focus_tag)}</Badge>}
                      </div>
                      {card.focus_text && (
                        <div className="break-words">
                          <span className="font-medium text-muted-foreground">Trecho: </span>
                          <span className="font-semibold text-foreground">{card.focus_text}</span>
                        </div>
                      )}
                      {(card.focus_note || card.notes) && (
                        <div className="mt-1 break-words text-muted-foreground">
                          <span className="font-medium">Obs: </span>{card.focus_note || card.notes}
                        </div>
                      )}
                    </div>
                  )}

                  {!hasFocus && (
                    <div className="mt-3 rounded-lg border border-dashed bg-muted/30 p-2 text-xs text-muted-foreground">
                      Sem foco específico. A IA ainda poderá inferir o que explicar.
                    </div>
                  )}

                  {card.hint && <p className="mt-2 break-words text-xs text-muted-foreground">Dica: {card.hint}</p>}
                </button>
              </div>
            </Card>;
          })}
        </div>
      </>}

      <SpecialExportDialog open={exportOpen} onOpenChange={setExportOpen} cards={exportCards} />
      <ImportExplanationsDialog open={importOpen} onOpenChange={setImportOpen} userId={userId} />
    </div>
  </div>;
}
