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
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import ImportExplanationsDialog from "@/components/ImportExplanationsDialog";
import SpecialExportDialog from "./components/SpecialExportDialog";

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

  return <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-8">
    <Helmet><title>Cards Especiais | App Piteco</title></Helmet>

    <div className="mb-6 flex flex-wrap items-center gap-3">
      <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
      <div className="rounded-xl bg-sky-100 p-2.5 dark:bg-sky-950/40"><Gem className="h-6 w-6 text-sky-600" /></div>
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Cards Especiais</h1>
        <p className="text-sm text-muted-foreground">Crie explicações detalhadas com IA</p>
      </div>
      <Badge variant="secondary" className="ml-auto">{cards.length} na fila</Badge>
      <Button onClick={() => setImportOpen(true)}><Upload className="mr-1.5 h-4 w-4" />Importar resposta</Button>
    </div>

    <Card className="mb-6 border-sky-200 bg-gradient-to-br from-sky-50 via-background to-violet-50 p-5 dark:border-sky-900 dark:from-sky-950/20 dark:to-violet-950/20">
      <div className="mb-3 flex items-center gap-2 font-semibold"><Sparkles className="h-5 w-5 text-sky-600" />Fluxo em três passos</div>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-background/80 p-3"><b>1. Selecione</b><p className="mt-1 text-xs text-muted-foreground">Escolha os cards desejados.</p></div>
        <div className="rounded-lg bg-background/80 p-3"><b>2. Prepare</b><p className="mt-1 text-xs text-muted-foreground">Baixe o CSV e copie o prompt.</p></div>
        <div className="rounded-lg bg-background/80 p-3"><b>3. Importe</b><p className="mt-1 text-xs text-muted-foreground">Aplique o arquivo preenchido.</p></div>
      </div>
    </Card>

    {authLoading || query.isLoading ? <LoadingSpinner message="Carregando especiais..." /> : !cards.length ? <Card className="p-10 text-center">
      <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
      <div className="font-semibold">A fila está vazia</div>
      <p className="mt-1 text-sm text-muted-foreground">Marque um flashcard como especial para ele aparecer aqui.</p>
    </Card> : <>
      <div className="sticky top-2 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
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

      <ScrollArea className="max-h-[68vh] pr-2"><div className="space-y-3">{cards.map((card) => <Card key={card.id} className={`p-4 transition ${selected.has(card.flashcard_id) ? "border-primary/50 bg-primary/5" : "hover:border-primary/30"}`}>
        <div className="flex items-start gap-3">
          <Checkbox checked={selected.has(card.flashcard_id)} onCheckedChange={() => toggle(card.flashcard_id)} className="mt-1" />
          <button type="button" onClick={() => toggle(card.flashcard_id)} className="min-w-0 flex-1 text-left">
            <div className="font-semibold">{card.term} <span className="font-normal text-muted-foreground">→ {card.translation}</span></div>
            <div className="mt-2 flex flex-wrap gap-2">
              {card.list_title && <Badge variant="secondary">{card.list_title}</Badge>}
              {card.context_tag && <Badge variant="outline">{card.context_tag}</Badge>}
              {card.layer_index != null && <Badge variant="outline">Camada {card.layer_index + 1}</Badge>}
            </div>
            {card.hint && <p className="mt-2 text-xs text-muted-foreground">Dica: {card.hint}</p>}
          </button>
        </div>
      </Card>)}</div></ScrollArea>
    </>}

    <SpecialExportDialog open={exportOpen} onOpenChange={setExportOpen} cards={exportCards} />
    <ImportExplanationsDialog open={importOpen} onOpenChange={setImportOpen} userId={userId} />
  </div>;
}
