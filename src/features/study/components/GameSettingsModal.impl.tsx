import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { Direction } from "@/features/study/lib/gameCore";
import type {
  StudyFlowModePreset,
  StudyPlayModePreset,
  StudyPlaySidePreset,
} from "@/features/study/preferences/studyPreset";
import { useAuth } from "@/contexts/AuthContext";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import { setPlayPresetRuntime, usePlayPresetRuntime } from "@/features/study/lib/playPresetRuntime";
import {
  DEFAULT_WRITE_CORRECTION_MODE,
  readWriteCorrectionMode,
  writeWriteCorrectionMode,
  type WriteCorrectionMode,
} from "@/features/study/lib/writeCorrectionMode";
import { cn } from "@/lib/utils";
import { emitStudyFlowModeChanged } from "@/features/study/lib/studyFlowModePreference";

export interface GameSettings {
  mode: "sequential" | "random";
  subset: "all" | "favorites";
  fastMode?: boolean;
  redFocus?: boolean;
}

interface GameSettingsModalProps {
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
  onRestart: () => void;
  disabled?: boolean;
  showFastMode?: boolean;
  onEditCurrentCard?: () => void;
  canEditCurrentCard?: boolean;
  direction?: Direction;
  onDirectionChange?: (direction: Direction) => void;
}

const MANUAL_DIRECTION_EVENT = "piteco:study-direction-manual";
const RED_FOCUS_TRANSITION_EVENT = "piteco:study-red-focus-transition";

export const GameSettingsModal: React.FC<GameSettingsModalProps> = ({
  settings,
  onSettingsChange,
  onRestart,
  disabled = false,
  showFastMode = false,
  onEditCurrentCard,
  canEditCurrentCard = true,
  direction,
  onDirectionChange,
}) => {
  const [open, setOpen] = useState(false);
  type SettingsPage = "home" | "flow" | "direction" | "correction" | "order" | "audio";
  const [page, setPage] = useState<SettingsPage>("home");
  useEffect(() => { if (!open) setPage("home"); }, [open]);
  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { effectivePreset, updateForCurrentScope } = useStudyPreferences(userId);
  const playRuntime = usePlayPresetRuntime();
  const listSession = location.pathname.includes("/list/")
    && (location.pathname.endsWith("/study") || location.pathname.endsWith("/mixed-study"));
  const urlMode = new URLSearchParams(location.search).get("mode");
  const isWriteMode = urlMode === "write";
  const isMixedMode = urlMode === "mixed";
  const supportsFlowModes = isWriteMode || isMixedMode;
  const supportsWriteCorrection = isWriteMode || isMixedMode;
  const [correctionMode, setCorrectionMode] = useState<WriteCorrectionMode>(
    () => (typeof window === "undefined" ? DEFAULT_WRITE_CORRECTION_MODE : readWriteCorrectionMode()),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WriteCorrectionMode>).detail;
      if (detail === "flexible" || detail === "hard") setCorrectionMode(detail);
    };
    window.addEventListener("ape:writeCorrectionModeChanged", handler as EventListener);
    return () => window.removeEventListener("ape:writeCorrectionModeChanged", handler as EventListener);
  }, []);

  const handleCorrectionModeChange = (next: WriteCorrectionMode) => {
    if (next === correctionMode) return;
    setCorrectionMode(next);
    writeWriteCorrectionMode(next);
  };

  const currentFlowMode: StudyFlowModePreset = effectivePreset.studyFlowMode;
  const handleFlowModeChange = (next: StudyFlowModePreset) => {
    if (next === currentFlowMode) return;
    updateForCurrentScope({ studyFlowMode: next });
    emitStudyFlowModeChanged(next);
  };

  useEffect(() => {
    setPlayPresetRuntime({
      playMode: effectivePreset.playMode,
      playSide: effectivePreset.playSide,
    });
  }, [effectivePreset.playMode, effectivePreset.playSide]);

  const handleRestart = () => {
    onRestart();
    setOpen(false);
  };

  const handleModeChange = (checked: boolean) => {
    onSettingsChange({ ...settings, mode: checked ? "random" : "sequential" });
  };

  const handleSubsetChange = (checked: boolean) => {
    onSettingsChange({ ...settings, subset: checked ? "favorites" : "all" });
  };

  const handleRedFocusChange = (checked: boolean) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(RED_FOCUS_TRANSITION_EVENT, {
        detail: { enabled: checked },
      }));
    }
    onSettingsChange({
      ...settings,
      mode: checked ? "sequential" : settings.mode,
      redFocus: checked,
    });
  };

  const handleFastModeChange = (checked: boolean) => {
    onSettingsChange({ ...settings, fastMode: checked });
  };

  const handlePlayModeChange = (playMode: StudyPlayModePreset) => {
    setPlayPresetRuntime({ playMode });
    updateForCurrentScope({ playMode });
  };

  const handlePlaySideChange = (playSide: StudyPlaySidePreset) => {
    setPlayPresetRuntime({ playSide });
    updateForCurrentScope({ playSide });
  };

  const currentDirection: Direction = direction
    ?? (new URLSearchParams(location.search).get("dir") as Direction | null)
    ?? "any";

  const applyDirection = (next: Direction) => {
    if (onDirectionChange) {
      onDirectionChange(next);
    } else {
      const params = new URLSearchParams(location.search);
      params.delete("direction");
      params.set("dir", next);
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(MANUAL_DIRECTION_EVENT, { detail: { direction: next } }));
      }
    }
  };

  const handleInvertDirection = () => {
    const next: Direction = currentDirection === "a-b" ? "b-a" : "a-b";
    applyDirection(next);
    setOpen(false);
  };

  const favoritesActive = settings.subset === "favorites";
  const redFocusActive = !!settings.redFocus;
  const sideActionPrefix = playRuntime.playMode === "single" ? "Somente" : "Começar em";

  const directionSummary = currentDirection === "a-b"
    ? `Responder em ${playRuntime.labelB}`
    : currentDirection === "b-a"
      ? `Responder em ${playRuntime.labelA}`
      : "Misto (alternado)";
  const orderSummary = `${
    redFocusActive ? "Sequencial (Foco Vermelho)" : settings.mode === "random" ? "Aleatória" : "Sequencial"
  } · ${favoritesActive ? "Apenas favoritos" : "Todos os cards"}`;
  const flowSummary = redFocusActive
    ? "Fluxo contínuo (Foco Vermelho)"
    : currentFlowMode === "mastery_rounds"
      ? "Rodadas de Domínio"
      : "Fluxo Contínuo";

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

  return (
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
          <DialogTitle>
            {page === "home" ? "Configurações da Sessão" : "Configurações da Sessão"}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-0 sm:pb-0 sm:pt-0">
          {page === "home" && (
            <div className="space-y-2">
              {supportsFlowModes && (
                <CategoryRow
                  icon={<Layers className="h-4 w-4" />}
                  title="Formato da sessão"
                  summary={flowSummary}
                  onClick={() => setPage("flow")}
                />
              )}
              {listSession && (
                <CategoryRow
                  icon={<ArrowLeftRight className="h-4 w-4" />}
                  title="Direção da prática"
                  summary={directionSummary}
                  onClick={() => setPage("direction")}
                />
              )}
              {supportsWriteCorrection && (
                <CategoryRow
                  icon={<SpellCheck className="h-4 w-4" />}
                  title="Correção da escrita"
                  summary={correctionMode === "hard" ? "Hard" : "Flexível"}
                  onClick={() => setPage("correction")}
                />
              )}
              <CategoryRow
                icon={<Filter className="h-4 w-4" />}
                title="Ordem e filtros"
                summary={orderSummary}
                onClick={() => setPage("order")}
              />
              {showFastMode && (
                <CategoryRow
                  icon={<Volume2 className="h-4 w-4" />}
                  title="Áudio e ritmo"
                  summary={`Play: ${playRuntime.playMode === "single" ? "um lado" : "dois lados"}${
                    settings.fastMode ? " · Fast Mode" : ""
                  }`}
                  onClick={() => setPage("audio")}
                />
              )}

              <div className="pt-2 space-y-2">
                {onEditCurrentCard && (
                  <Button
                    onClick={() => { onEditCurrentCard(); setOpen(false); }}
                    className="w-full"
                    variant="outline"
                    disabled={!canEditCurrentCard}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar explicação deste card
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
                onClick={() => handleFlowModeChange("mastery_rounds")}
                disabled={redFocusActive}
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
                  <ListChecks className="h-4 w-4" /> Rodadas de Domínio
                </span>
                <span className="text-sm text-muted-foreground">
                  Estude em rodadas de até 15 cards. Cards errados ou pulados voltam nas próximas rodadas até você acertar.
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleFlowModeChange("continuous")}
                disabled={redFocusActive}
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
                  <Shuffle className="h-4 w-4" /> Fluxo Contínuo
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
              <div className="grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  variant={currentDirection === "a-b" ? "default" : "outline"}
                  aria-pressed={currentDirection === "a-b"}
                  onClick={() => applyDirection("a-b")}
                  className="min-h-[44px] justify-start"
                >
                  <span className="truncate">Responder em {playRuntime.labelB}</span>
                </Button>
                <Button
                  type="button"
                  variant={currentDirection === "b-a" ? "default" : "outline"}
                  aria-pressed={currentDirection === "b-a"}
                  onClick={() => applyDirection("b-a")}
                  className="min-h-[44px] justify-start"
                >
                  <span className="truncate">Responder em {playRuntime.labelA}</span>
                </Button>
                <Button
                  type="button"
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
                  variant="ghost"
                  className="min-h-[44px] w-full"
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Inverter lado atual
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
              <SubpageHeader title="Ordem e filtros" />
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
              checked={settings.mode === "random" && !redFocusActive}
              onCheckedChange={handleModeChange}
              disabled={redFocusActive}
            />
          </div>

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
                Estuda só a Lista Vermelha, em fila única, sem repetir.
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
              <SubpageHeader title="Áudio e ritmo" />
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
                  checked={settings.fastMode ?? false}
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

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant={playRuntime.playMode === "both" ? "default" : "outline"}
                    size="sm"
                    aria-pressed={playRuntime.playMode === "both"}
                    onClick={() => handlePlayModeChange("both")}
                  >
                    Dois lados
                  </Button>
                  <Button
                    type="button"
                    variant={playRuntime.playMode === "single" ? "default" : "outline"}
                    size="sm"
                    aria-pressed={playRuntime.playMode === "single"}
                    onClick={() => handlePlayModeChange("single")}
                  >
                    Somente um lado
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant={playRuntime.playSide === "a" ? "secondary" : "outline"}
                    size="sm"
                    aria-pressed={playRuntime.playSide === "a"}
                    onClick={() => handlePlaySideChange("a")}
                    className="min-w-0"
                  >
                    <span className="truncate">{sideActionPrefix} {playRuntime.labelA}</span>
                  </Button>
                  <Button
                    type="button"
                    variant={playRuntime.playSide === "b" ? "secondary" : "outline"}
                    size="sm"
                    aria-pressed={playRuntime.playSide === "b"}
                    onClick={() => handlePlaySideChange("b")}
                    className="min-w-0"
                  >
                    <span className="truncate">{sideActionPrefix} {playRuntime.labelB}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
