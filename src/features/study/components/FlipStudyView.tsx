import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { ArrowUpDown, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import { listIdFromPath, isPublicListPath } from "@/lib/listRoute";
import { useListPrimarySide } from "@/lib/useListPrimarySide";
import { primarySideToDirection } from "@/lib/primarySideDirection";
import { getMixedFlipSlotMode, isMixedStudySession } from "@/features/study/lib/runtimeStudySchedule";
import {
  readFlipEntryAudioPreference,
  writeFlipEntryAudioPreference,
} from "@/features/study/lib/flipEntryAudioPreference";
import {
  readFlipDoomQueueWindow,
  readFlipDoomScrollPreference,
  writeFlipDoomScrollPreference,
  type FlipDoomPreviewCard,
} from "@/features/study/lib/flipDoomScroll";
import { StudyCardDeck } from "./StudyCardDeck";
import { FlipDoomScrollViewport } from "./FlipDoomScrollViewport";
import { MixedSlotActivity } from "./MixedSlotActivity";
import type { WriteSessionSettings } from "@/features/study/lib/writeActivityMode";

const LazyFlipStudyView = lazy(() =>
  import("./FlipStudyView.impl").then((module) => ({ default: module.FlipStudyView }))
);

type FlipStudyViewProps = ComponentProps<typeof LazyFlipStudyView> & {
  /** Configurações de escrita para o slot "write" das sessões mistas. */
  writeSettings?: WriteSessionSettings;
};

const doomPreviewCache = new Map<string, FlipDoomPreviewCard>();

function StudyModeFallback() {
  return (
    <div className="flex min-h-64 w-full items-center justify-center text-sm text-muted-foreground">
      Preparando modo Flip...
    </div>
  );
}

function useMobileFlipViewport(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)").matches : false,
  );

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);

  return mobile;
}

function currentPreviewFromProps(props: FlipStudyViewProps): FlipDoomPreviewCard | null {
  if (!props.flashcardId) return null;
  return {
    id: props.flashcardId,
    front: props.front,
    back: props.back,
    imageUrlA: props.imageUrlA,
    imageUrlB: props.imageUrlB,
  };
}

function DoomAdjacentPreview({
  card,
  direction,
  labelA,
  labelB,
}: {
  card: FlipDoomPreviewCard | null;
  direction: string;
  labelA?: string;
  labelB?: string;
}) {
  if (!card) return <div className="h-full w-full bg-background" />;
  const showBFirst = direction === "b-a";
  const text = showBFirst ? card.back : card.front;
  const label = showBFirst ? labelB : labelA;
  const imageUrl = showBFirst ? card.imageUrlB : card.imageUrlA;

  return (
    <div className="flex h-full w-full items-center justify-center bg-background px-0.5 py-14">
      <Card className="flex h-60 w-full max-w-2xl flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-card to-muted/20 p-4 shadow-sm">
        <p className="mb-3 text-[10px] uppercase tracking-wide text-muted-foreground">
          {label || (showBFirst ? "Definição" : "Termo")}
        </p>
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="mb-3 max-h-20 max-w-[70%] rounded-lg object-contain"
            loading="eager"
            decoding="async"
          />
        )}
        <p className="max-h-28 overflow-hidden px-3 text-center text-xl font-semibold leading-relaxed">
          {text}
        </p>
      </Card>
    </div>
  );
}

export const FlipStudyView = (props: FlipStudyViewProps) => {
  const listId = useMemo(() => listIdFromPath(window.location.pathname), []);
  const publicRoute = useMemo(() => isPublicListPath(window.location.pathname), []);
  const { side } = useListPrimarySide(listId, publicRoute);
  const cardKey = props.flashcardId || `${props.front}:${props.back}`;
  const mixedSlotMode = isMixedStudySession() ? getMixedFlipSlotMode(cardKey) : null;
  const [autoSpeakOnCardChange, setAutoSpeakOnCardChange] = useState(readFlipEntryAudioPreference);
  const [doomScrollEnabled, setDoomScrollEnabled] = useState(readFlipDoomScrollPreference);
  const [doomPreviousCard, setDoomPreviousCard] = useState<FlipDoomPreviewCard | null>(null);
  const [doomNextCard, setDoomNextCard] = useState<FlipDoomPreviewCard | null>(null);
  const mobileViewport = useMobileFlipViewport();
  const doomScrollActive = doomScrollEnabled && mobileViewport && !mixedSlotMode;
  const scheduledCardRef = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // O disparo do áudio de entrada é responsabilidade da view do Flip (contrato
    // de TTS), não de um clique simulado em botão do DOM.
    scheduledCardRef.current = cardKey;
  }, [cardKey]);

  useEffect(() => {
    const current = currentPreviewFromProps(props);
    if (current) doomPreviewCache.set(current.id, current);
  }, [props.back, props.flashcardId, props.front, props.imageUrlA, props.imageUrlB]);

  useEffect(() => {
    let cancelled = false;
    if (!doomScrollActive || !props.flashcardId) {
      setDoomPreviousCard(null);
      setDoomNextCard(null);
      return () => {
        cancelled = true;
      };
    }

    const queueWindow = readFlipDoomQueueWindow(props.flashcardId);
    if (!queueWindow) {
      setDoomPreviousCard(null);
      setDoomNextCard(null);
      return () => {
        cancelled = true;
      };
    }

    const syncFromCache = () => {
      setDoomPreviousCard(queueWindow.previousId ? doomPreviewCache.get(queueWindow.previousId) ?? null : null);
      setDoomNextCard(queueWindow.nextId ? doomPreviewCache.get(queueWindow.nextId) ?? null : null);
    };
    syncFromCache();

    const wantedIds = [queueWindow.previousId, queueWindow.nextId]
      .filter((id): id is string => Boolean(id))
      .filter((id) => !doomPreviewCache.has(id));
    if (wantedIds.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    const loadAdjacentCards = async () => {
      const client = publicRoute ? publicSupabase : supabase;
      const { data, error } = await client
        .from("flashcards")
        .select("id, term, translation, image_url_a, image_url_b")
        .in("id", wantedIds);
      if (cancelled || error || !data) return;
      data.forEach((row) => {
        doomPreviewCache.set(row.id, {
          id: row.id,
          front: row.term,
          back: row.translation,
          imageUrlA: row.image_url_a,
          imageUrlB: row.image_url_b,
        });
      });
      if (!cancelled) syncFromCache();
    };

    void loadAdjacentCards();
    return () => {
      cancelled = true;
    };
  }, [doomScrollActive, props.flashcardId, publicRoute]);

  const toggleAutoSpeak = () => {
    const next = !autoSpeakOnCardChange;
    setAutoSpeakOnCardChange(next);
    writeFlipEntryAudioPreference(next);
  };

  const toggleDoomScroll = () => {
    const next = !doomScrollEnabled;
    setDoomScrollEnabled(next);
    writeFlipDoomScrollPreference(next);
  };

  if (mixedSlotMode) {
    return (
      <MixedSlotActivity
        mode={mixedSlotMode}
        front={props.front}
        back={props.back}
        hint={props.hint}
        direction={props.direction}
        writeSettings={props.writeSettings}
        flashcardId={props.flashcardId}
        wordHintsA={props.wordHintsA}
        mergedHintsA={props.mergedHintsA}
        mergedHintsB={props.mergedHintsB}
        langA={props.langA}
        langB={props.langB}
        labelA={props.labelA}
        labelB={props.labelB}
        isFavorite={props.isFavorite}
        isRedListed={props.isRedListed}
        onToggleFavorite={props.onToggleFavorite}
        onToggleRedList={props.onToggleRedList}
        isSpecial={props.isSpecial}
        onToggleSpecial={props.onToggleSpecial}
        isDifficult={props.isDifficult}
        onToggleDifficulty={props.onToggleDifficulty}
        difficultyPending={props.difficultyPending}
        onCorrect={props.onKnew}
        onIncorrect={props.onDidntKnow}
        onPrevious={props.onPrevious}
        canGoPrevious={props.canGoPrevious}
        layerCount={props.layerCount}
        layersVisitedCount={props.layersVisitedCount}
        onOpenLayers={props.onOpenLayers}
      />
    );
  }

  const flipView = (
    <Suspense fallback={<StudyModeFallback />}>
      <LazyFlipStudyView
        {...props}
        autoSpeakOnCardChange={autoSpeakOnCardChange && !mixedSlotMode}
      />
    </Suspense>
  );

  const deck = doomScrollActive ? (
    <FlipDoomScrollViewport
      enabled
      cardKey={cardKey}
      current={flipView}
      previous={(
        <DoomAdjacentPreview
          card={doomPreviousCard}
          direction={props.direction}
          labelA={props.labelA}
          labelB={props.labelB}
        />
      )}
      next={(
        <DoomAdjacentPreview
          card={doomNextCard}
          direction={props.direction}
          labelA={props.labelA}
          labelB={props.labelB}
        />
      )}
      canGoPrevious={props.canGoPrevious !== false}
      canGoNext={props.canGoNext !== false && Boolean(props.onNext)}
      onPrevious={props.onPrevious}
      onNext={props.onNext}
    />
  ) : (
    <StudyCardDeck
      cardKey={cardKey}
      density={props.fastMode ? "regular" : "tall"}
      // Dono único de swipe no Flip clássico. O Doom Scroll preserva o motor
      // e troca apenas a superfície de navegação no mobile.
      swipeNavigation={{
        onNext: props.onNext,
        onPrevious: props.onPrevious,
        canGoNext: props.canGoNext,
        canGoPrevious: props.canGoPrevious,
      }}
    >
      {flipView}
    </StudyCardDeck>
  );

  const primaryLabel = side === "b" ? props.labelB : props.labelA;
  const sessionLabel = props.direction === "b-a" ? props.labelB : props.direction === "a-b" ? props.labelA : "Misto";
  const followsPrimary = props.direction === primarySideToDirection(side);
  const audioAvailable = props.ttsEnabled !== false;

  return (
    <div ref={rootRef} className="w-full space-y-2">
      <div className="flex flex-wrap justify-center gap-2 text-[11px]">
        {listId && (
          <>
            <span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">
              Principal: {primaryLabel}
            </span>
            {!followsPrimary && (
              <span className="rounded-full bg-amber-500/10 px-2 py-1 font-medium text-amber-700 dark:text-amber-300">
                Primeiro nesta sessão: {sessionLabel}
              </span>
            )}
          </>
        )}
        <Button
          type="button"
          variant={autoSpeakOnCardChange && audioAvailable ? "secondary" : "outline"}
          size="sm"
          className="h-7 gap-1.5 rounded-full px-2.5 text-[11px]"
          onClick={toggleAutoSpeak}
          disabled={!audioAvailable}
          aria-pressed={autoSpeakOnCardChange && audioAvailable}
          title={audioAvailable ? "Reproduzir o lado visível ao trocar de card" : "Áudio desativado nesta lista"}
        >
          {autoSpeakOnCardChange && audioAvailable
            ? <Volume2 className="h-3.5 w-3.5" />
            : <VolumeX className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Áudio ao trocar:</span>
          <span>{autoSpeakOnCardChange && audioAvailable ? "ligado" : "desligado"}</span>
        </Button>
        <Button
          type="button"
          variant={doomScrollEnabled ? "secondary" : "outline"}
          size="sm"
          className="h-7 gap-1.5 rounded-full px-2.5 text-[11px] sm:hidden"
          onClick={toggleDoomScroll}
          aria-pressed={doomScrollEnabled}
          title="Navegação vertical contínua no modo Flip"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          Doom scroll {doomScrollEnabled ? "ligado" : "desligado"}
        </Button>
      </div>
      {deck}
    </div>
  );
};
