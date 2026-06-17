import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Gem, Upload } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  const [userId, setUserId] = useState();
  const [selected, setSelected] = useState(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCards, setExportCards] = useState([]);
  const query = useSpecialFlashcardsDetails(userId);
  const cards = query.data || [];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => data.user ? setUserId(data.user.id) : navigate("/auth", { replace: true }));
  }, [navigate]);

  useEffect(() => {
    const valid = new Set(cards.map((card) => card.flashcard_id));
    setSelected((previous) => new Set([...previous].filter((id) => valid.has(id))));
  }, [cards]);

  const chosen = useMemo(() => cards.filter((card) => selected.has(card.flashcard_id)), [cards, selected]);
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

  return <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-8">
    <Helmet><title>Cards Especiais | APE</title></Helmet>
    <div className="flex items-center gap-3 mb-6">
      <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
      <Gem className="h-6 w-6 text-sky-500" /><h1 className="text-2xl sm:text-3xl font-bold">Especiais</h1>
      <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="ml-auto"><Upload className="h-4 w-4 mr-1" />Importar resposta</Button>
    </div>
    <div className="rounded-lg border bg-muted/30 p-3 mb-6 text-sm text-muted-foreground">Exporte em lotes pequenos. Os cards só saem daqui depois que uma explicação válida for aplicada.</div>
    {query.isLoading ? <LoadingSpinner message="Carregando especiais..." /> : !cards.length ? <Card className="p-8 text-center text-muted-foreground">Nenhum card especial ainda.</Card> : <>
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg bg-muted/40 border">
        <Checkbox checked={selected.size === cards.length} onCheckedChange={() => setSelected(selected.size === cards.length ? new Set() : new Set(cards.map((card) => card.flashcard_id)))} />
        <span className="text-sm text-muted-foreground mr-auto">{selected.size} de {cards.length}</span>
        <Button variant="outline" size="sm" onClick={() => exportTarget(chosen)} disabled={!chosen.length}><Download className="h-4 w-4 mr-1" />Selecionados</Button>
        <Button size="sm" onClick={() => exportTarget(cards)}><Download className="h-4 w-4 mr-1" />Todos em lotes</Button>
      </div>
      <ScrollArea className="max-h-[70vh]"><div className="space-y-3">{cards.map((card) => <Card key={card.id} className="p-4"><div className="flex gap-3 items-start">
        <Checkbox checked={selected.has(card.flashcard_id)} onCheckedChange={() => toggle(card.flashcard_id)} />
        <div className="flex-1 min-w-0"><div className="font-semibold">{card.term} <span className="font-normal text-muted-foreground">→ {card.translation}</span></div><div className="flex gap-2 mt-1">{card.list_title && <Badge variant="secondary">{card.list_title}</Badge>}{card.context_tag && <Badge variant="outline">{card.context_tag}</Badge>}</div>{card.hint && <p className="text-xs text-muted-foreground mt-2">Dica: {card.hint}</p>}</div>
      </div></Card>)}</div></ScrollArea>
    </>}
    <SpecialExportDialog open={exportOpen} onOpenChange={setExportOpen} cards={exportCards} />
    <ImportExplanationsDialog open={importOpen} onOpenChange={setImportOpen} userId={userId} />
  </div>;
}
