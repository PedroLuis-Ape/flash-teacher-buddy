import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, RefreshCw, Zap, Flame, Pencil, Keyboard, ArrowLeftRight, Play } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { Direction } from "@/features/study/lib/gameCore";
import type { StudyPlayModePreset, StudyPlaySidePreset } from "@/features/study/preferences/studyPreset";
import { useAuth } from "@/contexts/AuthContext";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import { setPlayPresetRuntime, usePlayPresetRuntime } from "@/features/study/lib/playPresetRuntime";

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
  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { effectivePreset, updateForCurrentScope } = useStudyPreferences(userId);
  const playRuntime = usePlayPresetRuntime();
  const listSession = location.pathname.includes("/list/")
    && (location.pathname.endsWith("/study") || location.pathname.endsWith("/mixed-study"));

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

  const handleInvertDirection = () => {
    const current = direction
      ?? (new URLSearchParams(location.search).get("dir") as Direction | null)
      ?? "any";
    const next: Direction = current === "a-b" ? "b-a" : "a-b";

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
    setOpen(false);
  };

  const favoritesActive = settings.subset === "favorites";
  const redFocusActive = !!settings.redFocus;
  const sideActionPrefix = playRuntime.playMode === "single" ? "Somente" : "Começar em";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="bg-background/50 backdrop-blur-sm hover:bg-background/80"
          disabled={disabled}
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações da Sessão</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="random-mode" className="font-medium">Ordem Aleatória</Label>
              <p className="text-sm text-muted-foreground">
                {redFocusActive ? "Desativada no Foco Vermelho" : "Embaralha os cards a cada reinício"}
              </p>
            </div>
            <Switch
              id="random-mode"
              checked={settings.mode === "random" && !redFocusActive}
              onCheckedChange={handleModeChange}
              disabled={redFocusActive}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="favorites-only" className="font-medium">Apenas Favoritos</Label>
              <p className="text-sm text-muted-foreground">Estude apenas os cards marcados com estrela</p>
            </div>
            <Switch
              id="favorites-only"
              checked={favoritesActive}
              onCheckedChange={handleSubsetChange}
              disabled={redFocusActive}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-red-500" />
                <Label htmlFor="red-focus" className="font-medium">Foco Vermelho</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Estuda só a Lista Vermelha, em fila única, sem repetir.
              </p>
            </div>
            <Switch
              id="red-focus"
              checked={redFocusActive}
              onCheckedChange={handleRedFocusChange}
            />
          </div>

          {showFastMode && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <Label htmlFor="fast-mode" className="font-medium">Fast Mode</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">Mostra os dois lados ao mesmo tempo</p>
                </div>
                <Switch
                  id="fast-mode"
                  checked={settings.fastMode ?? false}
                  onCheckedChange={handleFastModeChange}
                />
              </div>

              <div className="space-y-3 rounded-xl border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-primary" />
                    <Label className="font-medium">Configurações do Play</Label>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    O botão Play inicia imediatamente usando estas opções.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
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

                <div className="grid grid-cols-2 gap-2">
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
            </>
          )}

          {listSession && (
            <Button onClick={handleInvertDirection} className="w-full" variant="outline">
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Inverter lado
            </Button>
          )}

          {onEditCurrentCard && (
            <Button
              onClick={() => {
                onEditCurrentCard();
                setOpen(false);
              }}
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
      </DialogContent>
    </Dialog>
  );
};