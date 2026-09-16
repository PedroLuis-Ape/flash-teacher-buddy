import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Settings,
  RefreshCw,
  Zap,
  Flame,
  Pencil,
  Keyboard,
  ArrowLeftRight,
  Play,
  Shuffle,
  SpellCheck,
  ChevronLeft,
  ChevronRight,
  Layers,
  Filter,
  Volume2,
  ListChecks,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Direction } from "@/features/study/lib/gameCore";
import type {
  StudyFlowModePreset,
  StudyPlayTargetPreset,
} from "@/features/study/preferences/studyPreset";
import { usePlayPresetRuntime } from "@/features/study/lib/playPresetRuntime";
import type { WriteCorrectionMode } from "@/features/study/lib/writeCorrectionMode";
import {
  isDirectionLockedByFlowMode,
  type StudySettingsPatchV3,
  type StudySettingsSnapshotV3,
} from "@/features/study/lib/studySettingsSnapshotV3";
import { readStudyResumePointer } from "@/features/study/lib/studyResumePointer";
import { useAuthUser } from "@/hooks/useAuthUser";
import { supabase } from "@/integrations/supabase/client";
import { EditFlashcardDialog } from "@/components/EditFlashcardDialog";
import { cn } from "@/lib/utils";
import { WriteActivitySettings } from "./WriteActivitySettings";

/** Contrato legado do engine (ordem/subset da fila). Mantido para compatibilidade. */
export interface GameSettings {
  mode: "sequential" | "random";
  subset: "all" | "favorites";
  fastMode?: boolean;
  redFocus?: boolean;
}

type RuntimeEditableCard = {
  id: string;
  term: string;
  translation: string;
  hint?: string | null;
  image_url_a?: string | null;
  image_url_b?: string | null;
  word_hints?: unknown;
  list_id?: string;
  user_id?: string;
  parent_card_id?: string | null;
  note_text?: string[] | null;
  short_explanation?: string | null;
  detailed_explanation?: string | null;
  usage_notes?: string | null;
  common_mistakes?: string | null;
};

interface GameSettingsModalProps {
  /**
   * Configurações efetivamente usadas pela sessão, vindas do controlador único
   * em Study/MixedStudy. A janela é 100% controlada: não hidrata preferências,
   * não lê URL e não guarda estado de configuração próprio.
   */
  settings: StudySettingsSnapshotV3;
  onSettingsChange: (patch: StudySettingsPatchV3) => void;
  /** Confirms the current remote session is closed before changing flow. */
  onFlowModeChange?: (next: StudyFlowModePreset) => void | Promise<void>;
  /** Token canônico do modo (write, flip, mixed, ...). */
  gameMode: string;
  /** Sessão de lista privada — habilita a direção da prática. */
  showDirection?: boolean;
  onRestart: () => void;
  disabled?: boolean;
  showFastMode?: boolean;
  onEditCurrentCard?: () => void;
  canEditCurrentCard?: boolean;
}

export const GameSettingsModal: React.FC<GameSettingsModalProps> = ({
  settings,
  onSettingsChange,
  onFlowModeChange,
  gameMode,
  showDirection = false,
  onRestart,
  disabled = false,
  showFastMode = false,
  onEditCurrentCard,
  canEditCurrentCard = true,
}) => {
  const { user } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [isChangingFlow, setIsChangingFlow] = useState(false);
  const [resolvingCurrentCard, setResolvingCurrentCard] = useState(false);
  const [fallbackEditCard, setFallbackEditCard] = useState<RuntimeEditableCard | null>(null);
  type SettingsPage = "home" | "flow" | "direction" | "correction" | "order" | "content" | "audio";
  const [page, setPage] = useState<SettingsPage>("home");
  useEffect(() => { if (!open) setPage("home"); }, [open]);
  const playRuntime = usePlayPresetRuntime();
  const urlMode = gameMode;
  const isWriteMode = gameMode === "write";
  const isMixedMode = gameMode === "mixed";
  const listSession = showDirection;
  // Every playable mode supports both a gamified round flow and a continuous
  // run. Flip answers use the same engine gate as the other modes.
  const supportsFlowModes = Boolean(urlMode);
  const supportsWriteCorrection = isWriteMode || isMixedMode;
  const correctionMode: WriteCorrectionMode = settings.writeCorrectionMode;
  const currentFlowMode: StudyFlowModePreset = settings.studyFlowMode;
  const currentDirection: Direction = settings.direction;
  const favoritesActive = settings.scope === "favorites";
  const redFocusActive = settings.redFocus;

  const handleRestart = () => {
    onRestart();
    setOpen(false);
  };

  const handleCorrectionModeChange = (next: WriteCorrectionMode) => {
    if (next === correctionMode) return;
    onSettingsChange({ writeCorrectionMode: next });
  };

  const handleFlowModeChange = async (next: StudyFlowModePreset) => {
    if (next === currentFlowMode || isChangingFlow) return;
    setIsChangingFlow(true);
    try {
      await onFlowModeChange?.(next);
      onSettingsChange({ studyFlowMode: next });
    } catch (error) {
      console.error("[GameSettingsModal] Não foi possível trocar o formato:", error);
      toast.error("Não foi possível confirmar a sessão anterior no banco. O formato não foi alterado.");
    } finally {
      setIsChangingFlow(false);
    }
  };

  const handleModeChange = (checked: boolean) => {
    onSettingsChange({ order: checked ? "random" : "sequential" });
  };

  const handleSubsetChange = (checked: boolean) => {
    onSettingsChange({ scope: checked ? "favorites" : "all" });
  };

  const handleRedFocusChange = (checked: boolean) => {
    // Ordem/formato efetivos do Foco Vermelho vêm do contrato
    // (applyStudySettingsConstraints); o modal não reescreve ordem por conta.
    onSettingsChange({ redFocus: checked });
  };

  const handleFastModeChange = (checked: boolean) => {
    onSettingsChange({ fastMode: checked });
  };

  const handlePlayTargetChange = (playTarget: StudyPlayTargetPreset) => {
    onSettingsChange({ playTarget });
  };

  const applyDirection = (next: Direction) => {
    onSettingsChange({ direction: next });
  };

  const handleInvertDirection = () => {
    applyDirection(currentDirection === "a-b" ? "b-a" : "a-b");
    setOpen(false);
  };

  /**
   * Study already passes the exact visible card/layer through
   * `onEditCurrentCard`. MixedStudy uses the same settings component but did
   * not have a local editor. For that route we resolve the exact current card
   * from the resume pointer, which is published whenever card identity changes.
   * This keeps the feature available in every game mode without adding another
   * per-mode persistence system.
   */
  const handleEditCurrentCard = async () => {
    if (!canEditCurrentCard || resolvingCurrentCard) return;

    if (onEditCurrentCard) {
      onEditCurrentCard();
      setOpen(false);
      return;
    }

    if (!user?.id) {
      toast.error("Entre na sua conta para editar este card.");
      return;
    }

    const pointer = readStudyResumePointer(user.id);
    const currentPathname = typeof window === "undefined"
      ? ""
      : window.location.pathname.replace(/\/+$/, "");
    const pointerPathname = pointer?.path?.split("?")[0]?.replace(/\/+$/, "") ?? "";

    if (!pointer?.currentCardId || !currentPathname || pointerPathname !== currentPathname) {
      toast.error("Não foi possível identificar com segurança o card atual.");
      return;
    }

    setResolvingCurrentCard(true);
    try {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id,user_id,list_id,parent_card_id,term,translation,hint,image_url_a,image_url_b,word_hints,note_text,short_explanation,detailed_explanation,usage_notes,common_mistakes")
        .eq("id", pointer.currentCardId)
        .maybeSingle();

      if (error || !data) {
        console.error("[GameSettingsModal] Falha ao abrir o card atual:", error);
        toast.error("Não foi possível abrir o card atual para anotações.");
        return;
      }

      if ((data as any).user_id !== user.id) {
        toast.error("Você só pode editar cards que pertencem à sua conta.");
        return;
      }

      setFallbackEditCard(data as RuntimeEditableCard);
      setOpen(false);
    } finally {
      setResolvingCurrentCard(false);
    }
  };

  // No Modo gamificado a direção efetiva é sempre automática: as rodadas
  // alternam os lados por card. A preferência base do usuário fica intocada.
  const directionLockedByFlow = isDirectionLockedByFlowMode(settings.studyFlowMode);
  const promptLabel = currentDirection === "b-a" ? playRuntime.labelB : playRuntime.labelA;
  const answerLabel = currentDirection === "b-a" ? playRuntime.labelA : playRuntime.labelB;
  const derivedSidesHint = currentDirection === "any"
    ? "Os lados alternam por card."
    : `Pergunta em ${promptLabel} · resposta em ${answerLabel}.`;

  const directionSummary = currentDirection === "a-b"
    ? `Responder em ${playRuntime.labelB}`
    : currentDirection === "b-a"
      ? `Responder em ${playRuntime.labelA}`
      : directionLockedByFlow
        ? "Automática (modo gamificado)"
        : "Misto (alternado)";
  // Cada resumo mostra SOMENTE os valores da própria categoria: ordem não
  // repete filtros, formato não repete conteúdo, e quem fala de Foco Vermelho é
  // o conteúdo. O formato vem do snapshot efetivo (já com a restrição aplicada).
  const orderSummary = settings.order === "random" ? "Aleatória" : "Sequencial";
  const deckSummary = favoritesActive ? "Apenas favoritos" : "Todos os cards";
  const contentSummary = redFocusActive ? `${deckSummary} · Foco Vermelho` : deckSummary;
  const flowSummary = settings.studyFlowMode === "mastery_rounds" ? "Modo gamificado" : "Modo extenso";
  // Áudio e exibição fala de comportamento (tocar/mostrar), nunca de
  // English/Português — isso é papel exclusivo de "Direção da prática".
  const playTargetSummary = settings.playTarget === "prompt"
    ? "Toca só a pergunta"
    : settings.playTarget === "answer"
      ? "Toca só a resposta"
      : "Toca pergunta e resposta";
  const audioSummary = `${settings.fastMode ? "Mostra os dois lados" : "Um lado por vez"} · ${playTargetSummary}`;

  const CategoryRow: React.FC<{
    icon: React.ReactNode;
    title: string;
    summary: string;
    onClick: () => void;
  }> = ({ icon, title, summary, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border bg-background/40 px-4 py-3 text-left",
        "min-h-[56px] hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary/60",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        <span className="block truncate text-sm text-muted-foreground">{summary}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );

  const SubpageHeader: React.FC<{ title: string }> = ({ title }) => (
    <div className="flex items-center gap-2 border-b px-5 py-3 sm:border-0 sm:px-0 sm:pb-2 sm:pt-0">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setPage("home")}
        aria-label="Voltar"
        className="h-9 w-9"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <span className="truncate text-base font-semibold">{title}</span>
    </div>
  );

  const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="px-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="bg-background/50 backdrop-blur-sm hover:bg-background/80"
            disabled={disabled}
            aria-label="Abrir configurações da sessão"
            title="Configurações da sessão"
          >
            <Settings className="h-5 w-5 text-muted-foreground" />
          </Button>
        </DialogTrigger>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)] max-h-[calc(100dvh-1rem)] gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-[640px] sm:gap-4 sm:p-6">
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left sm:border-0 sm:p-0">
            <DialogTitle>Configurações da Sessão</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-0 sm:pb-0 sm:pt-0">
            {page === "home" && (
              <div className="space-y-2">
                <SectionLabel>Sessão</SectionLabel>
                {supportsFlowModes && (
                  <CategoryRow
                    icon={<Layers className="h-4 w-4" />}
                    title="Formato da sessão"
                    summary={flowSummary}
                    onClick={() => setPage("flow")}
                  />
                )}
                <CategoryRow
                  icon={<Filter className="h-4 w-4" />}
                  title="Ordem da fila"
                  summary={orderSummary}
                  onClick={() => setPage("order")}
                />

                <SectionLabel>Conteúdo e direção</SectionLabel>
                <CategoryRow
                  icon={<Flame className="h-4 w-4" />}
                  title="Conteúdo"
                  summary={contentSummary}
                  onClick={() => setPage("content")}
                />
                {listSession && (
                  <CategoryRow
                    icon={<ArrowLeftRight className="h-4 w-4" />}
                    title="Direção da prática"
                    summary={directionSummary}
                    onClick={() => setPage("direction")}
                  />
                )}

                {supportsWriteCorrection && (
                  <>
                    <SectionLabel>Escrita</SectionLabel>
                    <WriteActivitySettings
                      activityMode={settings.writeActivityMode}
                      rewriteSide={settings.writeRewriteSide}
                      rewritePromptMode={settings.writeRewritePromptMode}
                      onChange={onSettingsChange}
                    />
                    <CategoryRow
                      icon={<SpellCheck className="h-4 w-4" />}
                      title="Correção da escrita"
                      summary={correctionMode === "hard" ? "Hard" : "Flexível"}
                      onClick={() => setPage("correction")}
                    />
                  </>
                )}

                {showFastMode && (
                  <>
                    <SectionLabel>Áudio e exibição</SectionLabel>
                    <CategoryRow
                      icon={<Volume2 className="h-4 w-4" />}
                      title="Áudio e exibição"
                      summary={audioSummary}
                      onClick={() => setPage("audio")}
                    />
                  </>
                )}

                <div className="pt-2 space-y-2">
                  {(onEditCurrentCard || user?.id) && (
                    <Button
                      onClick={() => void handleEditCurrentCard()}
                      className="w-full"
                      variant="outline"
                      disabled={!canEditCurrentCard || resolvingCurrentCard}
                    >
                      {resolvingCurrentCard
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Pencil className="mr-2 h-4 w-4" />}
                      Editar / anotar este card
                    </Button>
                  )}
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/settings/shortcuts" onClick={() => setOpen(false)}>
                      <Keyboard className="mr-2 h-4 w-4" />
                      Configurar atalhos do teclado
                    </Link>
                  </Button>
                  <Button onClick={handleRestart} className="w-full" variant="default">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reiniciar Jogo
                  </Button>
                </div>
              </div>
            )}

            {page === "flow" && (
              <div className="space-y-4">
                <SubpageHeader title="Formato da sessão" />
                {redFocusActive && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
                    O Foco Vermelho usa uma fila contínua e não repete cards nesta sessão.
                    Ao desligar o Foco Vermelho, seu formato preferido volta.
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void handleFlowModeChange("mastery_rounds")}
                  disabled={redFocusActive || isChangingFlow}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 rounded-xl border p-4 text-left",
                    currentFlowMode === "mastery_rounds" && !redFocusActive
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/40 hover:bg-accent/40",
                    redFocusActive && "opacity-60",
                  )}
                  aria-pressed={currentFlowMode === "mastery_rounds"}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <ListChecks className="h-4 w-4" /> Modo gamificado
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Estude em rodadas de até 15 cards. Cards errados ou pulados voltam nas próximas rodadas até você acertar.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleFlowModeChange("continuous")}
                  disabled={redFocusActive || isChangingFlow}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 rounded-xl border p-4 text-left",
                    currentFlowMode === "continuous" && !redFocusActive
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/40 hover:bg-accent/40",
                    redFocusActive && "opacity-60",
                  )}
                  aria-pressed={currentFlowMode === "continuous"}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Shuffle className="h-4 w-4" /> Modo extenso
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Percorra todos os cards uma vez, do início ao fim, sem repetir automaticamente os erros.
                  </span>
                </button>
              </div>
            )}

            {page === "direction" && listSession && (
              <div className="space-y-3">
                <SubpageHeader title="Direção da prática" />
                <p className="text-sm text-muted-foreground">
                  Escolha em qual lado você quer responder durante esta sessão.
                </p>
                {directionLockedByFlow && (
                  <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
                    Direção automática — o modo gamificado alterna os lados por card.
                    Troque para o modo extenso para escolher um lado fixo.
                  </p>
                )}
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    type="button"
                    disabled={directionLockedByFlow}
                    variant={currentDirection === "a-b" ? "default" : "outline"}
                    aria-pressed={currentDirection === "a-b"}
                    onClick={() => applyDirection("a-b")}
                    className="min-h-[44px] justify-start"
                  >
                    <span className="truncate">Responder em {playRuntime.labelB}</span>
                  </Button>
                  <Button
                    type="button"
                    disabled={directionLockedByFlow}
                    variant={currentDirection === "b-a" ? "default" : "outline"}
                    aria-pressed={currentDirection === "b-a"}
                    onClick={() => applyDirection("b-a")}
                    className="min-h-[44px] justify-start"
                  >
                    <span className="truncate">Responder em {playRuntime.labelA}</span>
                  </Button>
                  <Button
                    type="button"
                    disabled={directionLockedByFlow}
                    variant={currentDirection === "any" ? "default" : "outline"}
                    aria-pressed={currentDirection === "any"}
                    onClick={() => applyDirection("any")}
                    className="min-h-[44px] justify-start"
                  >
                    <Shuffle className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">Misto (alternado)</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={handleInvertDirection}
                    disabled={directionLockedByFlow}
                    variant="ghost"
                    className="min-h-[44px] w-full"
                  >
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Inverter direção da sessão
                  </Button>
                </div>
              </div>
            )}

            {page === "correction" && supportsWriteCorrection && (
              <div className="space-y-3">
                <SubpageHeader title="Correção da escrita" />
                <p className="text-sm text-muted-foreground">
                  Como o app avalia sua resposta no modo Escrever.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant={correctionMode === "flexible" ? "default" : "outline"}
                    aria-pressed={correctionMode === "flexible"}
                    onClick={() => handleCorrectionModeChange("flexible")}
                    className="min-h-[44px]"
                  >
                    Flexível
                  </Button>
                  <Button
                    type="button"
                    variant={correctionMode === "hard" ? "default" : "outline"}
                    aria-pressed={correctionMode === "hard"}
                    onClick={() => handleCorrectionModeChange("hard")}
                    className="min-h-[44px]"
                  >
                    Hard
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Flexível aceita pequenos erros e mostra as correções. Hard exige a resposta exata.
                </p>
              </div>
            )}

            {page === "order" && (
              <div className="space-y-4">
                <SubpageHeader title="Ordem da fila" />
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="random-mode" className="font-medium">Ordem Aleatória</Label>
                    <p className="text-sm text-muted-foreground">
                      {redFocusActive ? "Desativada no Foco Vermelho" : "Embaralha os cards a cada reinício"}
                    </p>
                  </div>
                  <Switch
                    id="random-mode"
                    className="shrink-0"
                    checked={settings.order === "random" && !redFocusActive}
                    onCheckedChange={handleModeChange}
                    disabled={redFocusActive}
                  />
                </div>
              </div>
            )}

            {page === "content" && (
              <div className="space-y-4">
                <SubpageHeader title="Conteúdo" />
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="favorites-only" className="font-medium">Apenas Favoritos</Label>
                    <p className="text-sm text-muted-foreground">Estude apenas os cards marcados com estrela</p>
                  </div>
                  <Switch
                    id="favorites-only"
                    className="shrink-0"
                    checked={favoritesActive}
                    onCheckedChange={handleSubsetChange}
                    disabled={redFocusActive}
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 shrink-0 text-red-500" />
                      <Label htmlFor="red-focus" className="font-medium">Foco Vermelho</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Estuda só a Lista Vermelha, em fila única e no modo extenso, sem repetir. Ao desligar, a sua ordem e o seu formato anteriores voltam.
                    </p>
                  </div>
                  <Switch
                    id="red-focus"
                    className="shrink-0"
                    checked={redFocusActive}
                    onCheckedChange={handleRedFocusChange}
                  />
                </div>
              </div>
            )}

            {page === "audio" && showFastMode && (
              <div className="space-y-4">
                <SubpageHeader title="Áudio e exibição" />
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 shrink-0 text-yellow-500" />
                      <Label htmlFor="fast-mode" className="font-medium">Fast Mode</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">Mostra os dois lados ao mesmo tempo</p>
                  </div>
                  <Switch
                    id="fast-mode"
                    className="shrink-0"
                    checked={settings.fastMode}
                    onCheckedChange={handleFastModeChange}
                  />
                </div>

                <div className="space-y-3 rounded-xl border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Play className="h-4 w-4 shrink-0 text-primary" />
                      <Label className="font-medium">Configurações do Play</Label>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      O botão Play inicia imediatamente usando estas opções.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      type="button"
                      variant={settings.playTarget === "both" ? "default" : "outline"}
                      size="sm"
                      aria-pressed={settings.playTarget === "both"}
                      onClick={() => handlePlayTargetChange("both")}
                      className="min-h-[44px] justify-start"
                    >
                      <span className="truncate">Pergunta + resposta</span>
                    </Button>
                    <Button
                      type="button"
                      variant={settings.playTarget === "prompt" ? "default" : "outline"}
                      size="sm"
                      aria-pressed={settings.playTarget === "prompt"}
                      onClick={() => handlePlayTargetChange("prompt")}
                      className="min-h-[44px] justify-start"
                    >
                      <span className="truncate">Somente pergunta</span>
                    </Button>
                    <Button
                      type="button"
                      variant={settings.playTarget === "answer" ? "default" : "outline"}
                      size="sm"
                      aria-pressed={settings.playTarget === "answer"}
                      onClick={() => handlePlayTargetChange("answer")}
                      className="min-h-[44px] justify-start"
                    >
                      <span className="truncate">Somente resposta</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Quem define os lados é a Direção da prática. {derivedSidesHint}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <EditFlashcardDialog
        flashcard={fallbackEditCard}
        isOpen={!!fallbackEditCard}
        onClose={() => setFallbackEditCard(null)}
        studyType="language"
        labelA={playRuntime.labelA}
        labelB={playRuntime.labelB}
        contentMode="notes-only"
      />
    </>
  );
};
