import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Heart, RefreshCcw, Settings2, Sparkles, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { prepareLayeredStudyDeck } from "@/lib/studyDeck";
import { hashToBool, normalizeDirection, type Direction } from "@/features/study/lib/gameCore";
import { scoreCard, type CardProgressLike } from "@/features/study/lib/intelligenceScoring";
import { useAdaptiveMixedSession } from "@/features/study/hooks/useAdaptiveMixedSession";
import { useAuth } from "@/contexts/AuthContext";
import { WriteStudyView } from "@/features/study/components/WriteStudyView";
import { MultipleChoiceStudyView } from "@/features/study/components/MultipleChoiceStudyView";
import { UnscrambleStudyView } from "@/features/study/components/UnscrambleStudyView";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface MixedFlashcard {
  id: string;
  term: string;
  translation: string;
  hint?: string | null;
  accepted_answers_en?: string[];
  accepted_answers_pt?: string[];
  word_hints?: unknown;
  parent_card_id?: string | null;
  created_at?: string;
}

const DEFAULT_LABELS = {
  langA: "en",
  langB: "pt",
  labelA: "English",
  labelB: "Português",
};

function getActivityLabel(mode: string | null): string {
  if (mode === "write") return "Escrever";
  if (mode === "multiple-choice") return "Múltipla Escolha";
  if (mode === "unscramble") return "Organizar Frase";
  return "Prática Mista";
}

export default function MixedStudy() {
  const { id, collectionId } = useParams();
  const resolvedId = (id as string) || (collectionId as string) || "";
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { status: authStatus, userId, session } = useAuth();
  const isCollectionRoute = location.pathname.includes("/collection/");
  const isListRoute = !isCollectionRoute;
  const listId = isListRoute ? resolvedId : undefined;

  const [cards, setCards] = useState<MixedFlashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [labels, setLabels] = useState(DEFAULT_LABELS);
  const [weightByCardId, setWeightByCardId] = useState<Record<string, number>>({});
  const [remoteState, setRemoteState] = useState<unknown>(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [studySessionId, setStudySessionId] = useState<string | null>(null);

  const directionParam = searchParams.get("dir") || searchParams.get("direction") || "any";
  const baseDirection: Direction = normalizeDirection(directionParam);
  const scopeKey = [
    "adaptive-mixed-v1",
    userId || "anon",
    isListRoute ? "list" : "collection",
    resolvedId,
    searchParams.get("favorites") === "true" ? "favorites" : "all",
  ].join(":");

  useEffect(() => {
    if (!resolvedId) return;
    if (authStatus === "loading") return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let rawCards: MixedFlashcard[] = [];
        if (isListRoute && !session) {
          rawCards = await fetchAllSupabaseRows<MixedFlashcard>((from, to) =>
            (supabase as any)
              .rpc("get_portal_flashcards", { _list_id: resolvedId })
              .range(from, to),
          );
        } else {
          const queryColumn = isListRoute ? "list_id" : "collection_id";
          rawCards = await fetchAllSupabaseRows<MixedFlashcard>((from, to) =>
            (supabase as any)
              .from("flashcards")
              .select("*")
              .eq(queryColumn, resolvedId)
              .is("deleted_at", null)
              .order("created_at", { ascending: true })
              .order("id", { ascending: true })
              .range(from, to),
          );
        }

        const prepared = prepareLayeredStudyDeck(rawCards as any[]) as MixedFlashcard[];
        if (!cancelled) setCards(prepared);

        if (isListRoute) {
          const { data: listRow } = await (supabase as any)
            .from("lists")
            .select("folder_id, lang_a, lang_b, labels_a, labels_b")
            .eq("id", resolvedId)
            .maybeSingle();
          let folderRow: any = null;
          if (listRow?.folder_id) {
            const folderResult = await (supabase as any)
              .from("folders")
              .select("lang_a, lang_b, labels_a, labels_b")
              .eq("id", listRow.folder_id)
              .maybeSingle();
            folderRow = folderResult.data;
          }
          if (!cancelled && (listRow || folderRow)) {
            setLabels({
              langA: listRow?.lang_a || folderRow?.lang_a || "en",
              langB: listRow?.lang_b || folderRow?.lang_b || "pt",
              labelA: listRow?.labels_a || folderRow?.labels_a || "Lado A",
              labelB: listRow?.labels_b || folderRow?.labels_b || "Lado B",
            });
          }
        }

        if (userId && listId) {
          const { data: progressRows } = await (supabase as any)
            .from("flashcard_progress")
            .select("flashcard_id, correct_count, incorrect_count, last_reviewed")
            .eq("user_id", userId)
            .eq("list_id", listId);
          const weights: Record<string, number> = {};
          (progressRows ?? []).forEach((progress: CardProgressLike) => {
            weights[progress.flashcard_id] = 1 + Math.max(0, scoreCard({
              id: progress.flashcard_id,
              progress,
            })) * 10;
          });
          if (!cancelled) setWeightByCardId(weights);

          const { data: openSession } = await (supabase as any)
            .from("study_sessions")
            .select("id, cards_order")
            .eq("user_id", userId)
            .eq("list_id", listId)
            .eq("mode", "mixed-adaptive")
            .eq("completed", false)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!cancelled) {
            setStudySessionId(openSession?.id ?? null);
            setRemoteState(openSession?.cards_order ?? null);
          }
        }
      } catch (error) {
        console.error("[MixedStudy] Falha ao preparar sessão", error);
        toast.error("Não foi possível preparar a Prática Mista.");
      } finally {
        if (!cancelled) {
          setRemoteLoaded(true);
          setLoading(false);
        }
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [authStatus, isListRoute, listId, resolvedId, session, userId]);

  const persistRemoteState = useCallback(async (state: any) => {
    if (!userId || !listId) return;
    const payload = {
      user_id: userId,
      list_id: listId,
      mode: "mixed-adaptive",
      current_index: state.currentIndex,
      cards_order: state,
      completed: state.status === "journey-complete",
      total_cards: state.allCardIds.length,
      correct_answers: state.masteredCardIds.length,
      wrong_answers: state.pendingCardIds.length,
      skipped_answers: 0,
      updated_at: new Date().toISOString(),
      completed_at: state.status === "journey-complete" ? new Date().toISOString() : null,
    };

    if (studySessionId) {
      await (supabase as any).from("study_sessions").update(payload).eq("id", studySessionId);
      return;
    }

    const { data } = await (supabase as any)
      .from("study_sessions")
      .insert(payload)
      .select("id")
      .single();
    if (data?.id) setStudySessionId(data.id);
  }, [listId, studySessionId, userId]);

  const cardIds = useMemo(() => cards.map((card) => card.id), [cards]);
  const mixed = useAdaptiveMixedSession({
    cardIds,
    storageKey: scopeKey,
    remoteState,
    remoteLoaded,
    weightByCardId,
    onPersist: persistRemoteState,
  });

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const currentCard = mixed.currentCardId ? cardById.get(mixed.currentCardId) : undefined;
  const resolvedDirection: Direction = baseDirection === "any"
    ? (mixed.currentCardId && hashToBool(mixed.currentCardId) ? "a-b" : "b-a")
    : baseDirection;

  const recordAttempt = useCallback(async (cardId: string, correct: boolean, skipped: boolean) => {
    if (!userId || !listId || skipped) return;
    const client = supabase as any;
    const { data: existing } = await client
      .from("flashcard_progress")
      .select("id, correct_count, incorrect_count")
      .eq("user_id", userId)
      .eq("flashcard_id", cardId)
      .maybeSingle();

    if (existing) {
      await client.from("flashcard_progress").update({
        correct_count: (existing.correct_count ?? 0) + (correct ? 1 : 0),
        incorrect_count: (existing.incorrect_count ?? 0) + (correct ? 0 : 1),
        last_reviewed: new Date().toISOString(),
        list_id: listId,
      }).eq("id", existing.id);
    } else {
      await client.from("flashcard_progress").insert({
        user_id: userId,
        flashcard_id: cardId,
        list_id: listId,
        correct_count: correct ? 1 : 0,
        incorrect_count: correct ? 0 : 1,
        last_reviewed: new Date().toISOString(),
      });
    }
  }, [listId, userId]);

  const handleAnswer = useCallback((correct: boolean, skipped = false) => {
    if (!mixed.currentCardId) return;
    void recordAttempt(mixed.currentCardId, correct, skipped);
    mixed.answer(correct, skipped);
  }, [mixed, recordAttempt]);

  const exit = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }

    const contextParams = new URLSearchParams();
    for (const key of ["guest", "turma", "atribuicao"]) {
      const value = searchParams.get(key);
      if (value) contextParams.set(key, value);
    }
    const query = contextParams.toString();

    if (location.pathname.startsWith("/portal/list/")) {
      navigate(`/portal/list/${resolvedId}/games${query ? `?${query}` : ""}`);
    } else if (location.pathname.startsWith("/portal/collection/")) {
      navigate(`/portal/collection/${resolvedId}`);
    } else {
      navigate(isListRoute ? `/list/${resolvedId}/games` : `/collection/${resolvedId}/games`);
    }
  };

  const restartRoundManually = () => {
    if (window.confirm("Reiniciar somente esta rodada? O percurso completo será preservado.")) {
      mixed.restartRound();
    }
  };

  const restartJourneyManually = () => {
    if (window.confirm("Reiniciar todo o percurso da Prática Mista desde o começo?")) {
      mixed.restartJourney();
    }
  };

  if (loading || !mixed.state || !mixed.progress) {
    return <div className="grid min-h-[70vh] place-items-center text-muted-foreground">Preparando Prática Mista...</div>;
  }

  const { state, progress } = mixed;

  if (state.status === "round-failed") {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <Card className="mx-auto max-w-xl space-y-6 p-6 text-center sm:p-10">
          <div className="flex justify-center gap-2" aria-label="Sem corações restantes">
            {Array.from({ length: state.maxHearts }).map((_, index) => (
              <Heart key={index} className="h-10 w-10 text-muted-foreground/35" />
            ))}
          </div>
          <div>
            <h1 className="text-2xl font-bold">Vamos tentar esta rodada novamente</h1>
            <p className="mt-2 text-muted-foreground">
              Você não voltou ao começo da lista. Os mesmos {state.currentRoundCardIds.length} cards serão reorganizados.
            </p>
          </div>
          <Button size="lg" className="w-full" onClick={mixed.restartRound}>
            <RefreshCcw className="mr-2 h-5 w-5" /> Recuperar corações e continuar
          </Button>
          <Button variant="ghost" onClick={exit}>Sair e continuar depois</Button>
        </Card>
      </div>
    );
  }

  if (state.status === "round-complete") {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <Card className="mx-auto max-w-xl space-y-6 p-6 text-center sm:p-10">
          <Sparkles className="mx-auto h-14 w-14 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Rodada {state.roundNumber} concluída</h1>
            <p className="mt-2 text-muted-foreground">
              {state.currentRoundErrors.length === 0
                ? "Você dominou todos os cards desta rodada."
                : `${state.currentRoundErrors.length} card(s) voltarão na próxima rodada com novos exercícios.`}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border p-3"><strong className="block text-xl">{progress.masteredCards}</strong>dominados</div>
            <div className="rounded-xl border p-3"><strong className="block text-xl">{progress.pendingCards}</strong>pendentes</div>
            <div className="rounded-xl border p-3"><strong className="block text-xl">{progress.unseenCards}</strong>novos</div>
          </div>
          <Button size="lg" className="w-full" onClick={mixed.nextRound}>Começar próxima rodada</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={restartRoundManually}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refazer rodada
            </Button>
            <Button variant="ghost" onClick={restartJourneyManually}>Reiniciar percurso</Button>
          </div>
          <Button variant="ghost" onClick={exit}>Sair e continuar depois</Button>
        </Card>
      </div>
    );
  }

  if (state.status === "journey-complete") {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <Card className="mx-auto max-w-xl space-y-6 p-6 text-center sm:p-10">
          <Trophy className="mx-auto h-16 w-16 text-amber-500" />
          <div>
            <h1 className="text-3xl font-bold">Percurso concluído!</h1>
            <p className="mt-2 text-muted-foreground">Você dominou os {progress.totalCards} cards desta lista.</p>
          </div>
          <Button size="lg" className="w-full" onClick={mixed.restartJourney}>Jogar novamente</Button>
          <Button variant="outline" className="w-full" onClick={exit}>Voltar</Button>
        </Card>
      </div>
    );
  }

  if (!currentCard) {
    return <div className="grid min-h-[70vh] place-items-center text-muted-foreground">Card indisponível.</div>;
  }

  const sharedProps = {
    front: currentCard.term,
    back: currentCard.translation,
    hint: currentCard.hint,
    flashcardId: currentCard.id,
    wordHintsA: currentCard.word_hints,
    direction: resolvedDirection,
    langA: labels.langA,
    langB: labels.langB,
    onCorrect: () => handleAnswer(true),
    onIncorrect: () => handleAnswer(false),
    onSkip: () => handleAnswer(false, true),
  };

  return (
    <div className="min-h-screen bg-background px-2 py-2 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-2 sm:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={exit}>
            <ArrowLeft className="mr-1 h-4 w-4" />Sair
          </Button>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary sm:px-3 sm:text-xs">
              ⭐ Recomendado
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Configurações da sessão">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Configurações da sessão</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={restartRoundManually}>
                  <RefreshCcw className="mr-2 h-4 w-4" /> Reiniciar rodada
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={restartJourneyManually}>
                  Reiniciar percurso
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Card className="space-y-2 p-2.5 sm:space-y-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Rodada {state.roundNumber} · Tentativa {state.attemptNumber}</p>
              <p className="text-xs text-muted-foreground">{getActivityLabel(mixed.activityMode)} · Card {progress.roundPosition} de {progress.roundTotal}</p>
            </div>
            <div className="flex gap-1" aria-label={`${state.hearts} de ${state.maxHearts} corações`}>
              {Array.from({ length: state.maxHearts }).map((_, index) => (
                <Heart
                  key={index}
                  className={index < state.hearts ? "h-6 w-6 fill-red-500 text-red-500 sm:h-7 sm:w-7" : "h-6 w-6 text-muted-foreground/30 sm:h-7 sm:w-7"}
                />
              ))}
            </div>
          </div>
          <Progress value={progress.overallPercent} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress.masteredCards} de {progress.totalCards} dominados</span>
            <span>{progress.pendingCards} revisões pendentes</span>
          </div>

        </Card>

        <div key={`${state.roundNumber}:${state.attemptNumber}:${currentCard.id}:${mixed.activityMode}`}>
          {mixed.activityMode === "multiple-choice" && (
            <MultipleChoiceStudyView
              currentCard={currentCard}
              allCards={cards}
              direction={resolvedDirection}
              langA={labels.langA}
              langB={labels.langB}
              onCorrect={() => handleAnswer(true)}
              onIncorrect={() => handleAnswer(false)}
            />
          )}
          {mixed.activityMode === "unscramble" && <UnscrambleStudyView {...sharedProps} />}
          {(mixed.activityMode === "write" || !mixed.activityMode) && (
            <WriteStudyView
              {...sharedProps}
              acceptedAnswersEn={currentCard.accepted_answers_en}
              acceptedAnswersPt={currentCard.accepted_answers_pt}
            />
          )}
        </div>
      </div>
    </div>
  );
}
