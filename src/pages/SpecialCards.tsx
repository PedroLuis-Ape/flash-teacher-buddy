import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  useSpecialFlashcardsDetails,
  useRemoveSpecialFlashcards,
  type SpecialFlashcardDetail,
} from "@/hooks/useSpecialFlashcards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  ArrowLeft,
  Copy,
  Download,
  Gem,
  Trash2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";

const PROMPT_HEADER = `Você é uma IA especializada em ensino de inglês para brasileiros.
Vou enviar uma lista de cards especiais do meu app de estudos.
Para cada card, crie uma explicação detalhada, clara e didática.

Regras:
1. Explique o significado principal do card.
2. Explique quando usar.
3. Explique a diferença em relação a traduções parecidas, se houver.
4. Dê 2 exemplos em inglês com tradução.
5. Se for phrasal verb, explique a lógica da construção.
6. Se o card for uma camada/sentido específico de uma palavra, explique apenas aquele sentido específico, não todos os sentidos possíveis.
7. Não misture cards diferentes.
8. Mantenha cada explicação separada.
9. Use linguagem simples, útil para aluno brasileiro.
10. Responda em JSON válido.

Formato obrigatório:
[
  {
    "flashcard_id": "id do card",
    "term": "termo",
    "translation": "tradução",
    "detailed_explanation": "explicação detalhada",
    "examples": [
      { "en": "frase em inglês", "pt": "tradução em português" },
      { "en": "frase em inglês", "pt": "tradução em português" }
    ],
    "usage_notes": "observações de uso",
    "common_mistakes": "erros comuns"
  }
]

Cards:
`;

function buildPrompt(cards: SpecialFlashcardDetail[]): string {
  const payload = cards.map((c) => ({
    flashcard_id: c.flashcard_id,
    term: c.term,
    translation: c.translation,
    hint: c.hint,
    context_tag: c.context_tag,
    example_text: c.example_text,
    example_translation: c.example_translation,
    layer_index: c.layer_index,
    parent_card_id: c.parent_card_id,
    list_id: c.list_id,
    list_title: c.list_title,
  }));
  return PROMPT_HEADER + JSON.stringify(payload, null, 2);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function SpecialCards() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) {
        navigate("/auth", { replace: true });
        return;
      }
      setUserId(data.user.id);
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const { data: cards = [], isLoading } = useSpecialFlashcardsDetails(userId);
  const removeMany = useRemoveSpecialFlashcards();

  // Drop selections that no longer exist
  useEffect(() => {
    setSelected((prev) => {
      const valid = new Set(cards.map((c) => c.flashcard_id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      return next;
    });
  }, [cards]);

  const selectedCards = useMemo(
    () => cards.filter((c) => selected.has(c.flashcard_id)),
    [cards, selected]
  );

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (selected.size === cards.length) setSelected(new Set());
    else setSelected(new Set(cards.map((c) => c.flashcard_id)));
  };

  const handleExport = async (which: "selected" | "all") => {
    const target = which === "all" ? cards : selectedCards;
    if (target.length === 0) {
      toast.error("Nenhum card para exportar");
      return;
    }
    const prompt = buildPrompt(target);
    const ok = await copyToClipboard(prompt);
    if (!ok) {
      toast.error("Não foi possível copiar — copie manualmente");
      return;
    }
    await removeMany.mutateAsync(target.map((c) => c.flashcard_id));
    setSelected(new Set());
    toast.success("Cards exportados e removidos dos especiais");
  };

  const handleCopyPromptOnly = async () => {
    const target = selectedCards.length > 0 ? selectedCards : cards;
    if (target.length === 0) {
      toast.error("Nenhum card para copiar");
      return;
    }
    const prompt = buildPrompt(target);
    const ok = await copyToClipboard(prompt);
    toast[ok ? "success" : "error"](
      ok ? "Prompt copiado (sem remover)" : "Não foi possível copiar"
    );
  };

  const handleRemoveOne = async (flashcardId: string) => {
    await removeMany.mutateAsync([flashcardId]);
    toast.success("Removido dos especiais");
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <Helmet>
        <title>Cards Especiais | APE</title>
        <meta
          name="description"
          content="Fila de cards especiais para gerar explicações detalhadas com IA."
        />
      </Helmet>

      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Gem className="h-6 w-6 text-sky-500" />
          <h1 className="text-2xl sm:text-3xl font-bold">Especiais</h1>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Fila temporária. Após exportar para a IA, os cards saem automaticamente
        da lista. Para trabalhar de novo, marque como especial durante o estudo.
      </p>

      {isLoading ? (
        <LoadingSpinner message="Carregando especiais..." />
      ) : cards.length === 0 ? (
        <Card className="p-8 text-center">
          <Gem className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            Nenhum card especial ainda. Durante o estudo, toque no ícone 💎 para
            adicionar.
          </p>
        </Card>
      ) : (
        <>
          {/* Top action bar */}
          <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg bg-muted/40 border">
            <div className="flex items-center gap-2 mr-auto">
              <Checkbox
                checked={selected.size === cards.length && cards.length > 0}
                onCheckedChange={toggleAll}
                aria-label="Selecionar todos"
              />
              <span className="text-sm text-muted-foreground">
                {selected.size} de {cards.length} selecionados
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPromptOnly}
              disabled={removeMany.isPending}
            >
              <Copy className="h-4 w-4 mr-1.5" />
              Copiar prompt
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("selected")}
              disabled={selected.size === 0 || removeMany.isPending}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Exportar selecionados
            </Button>
            <Button
              size="sm"
              onClick={() => handleExport("all")}
              disabled={cards.length === 0 || removeMany.isPending}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Exportar todos
            </Button>
          </div>

          <ScrollArea className="max-h-[70vh]">
            <div className="grid grid-cols-1 gap-3">
              {cards.map((c) => {
                const isSelected = selected.has(c.flashcard_id);
                const isLayer = c.parent_card_id != null || c.layer_index != null;
                return (
                  <Card key={c.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(c.flashcard_id)}
                        aria-label={`Selecionar ${c.term}`}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold break-words">{c.term}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="break-words">{c.translation}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {c.list_title && (
                            <Badge variant="secondary">{c.list_title}</Badge>
                          )}
                          {isLayer && (
                            <Badge variant="outline" className="gap-1">
                              <Layers className="h-3 w-3" />
                              Camada{c.layer_index != null ? ` ${c.layer_index + 1}` : ""}
                            </Badge>
                          )}
                          {c.context_tag && <Badge variant="outline">{c.context_tag}</Badge>}
                        </div>
                        {c.hint && (
                          <p className="text-xs text-muted-foreground mt-2">
                            <span className="font-medium">Dica:</span> {c.hint}
                          </p>
                        )}
                        {(c.example_text || c.example_translation) && (
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            {c.example_text && <p>“{c.example_text}”</p>}
                            {c.example_translation && (
                              <p className="italic">“{c.example_translation}”</p>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOne(c.flashcard_id)}
                        disabled={removeMany.isPending}
                        title="Remover dos especiais"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}