import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, RefreshCw, Zap } from "lucide-react";

export interface GameSettings {
  mode: 'sequential' | 'random';
  subset: 'all' | 'favorites';
  fastMode?: boolean;
}

interface GameSettingsModalProps {
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
  onRestart: () => void;
  disabled?: boolean;
  showFastMode?: boolean;
}

const FAST_MODE_STORAGE_KEY = 'piteco_flip_fast_mode';

export const GameSettingsModal: React.FC<GameSettingsModalProps> = ({ 
  settings, 
  onSettingsChange, 
  onRestart,
  disabled = false,
  showFastMode = false 
}) => {
  const [open, setOpen] = useState(false);

  // Load fast mode preference from localStorage on mount
  useEffect(() => {
    if (showFastMode) {
      const stored = localStorage.getItem(FAST_MODE_STORAGE_KEY);
      if (stored !== null && settings.fastMode === undefined) {
        onSettingsChange({ ...settings, fastMode: stored === 'true' });
      }
    }
  }, [showFastMode]);

  const handleRestart = () => {
    onRestart();
    setOpen(false);
  };

  const handleModeChange = (checked: boolean) => {
    onSettingsChange({
      ...settings,
      mode: checked ? 'random' : 'sequential'
    });
  };

  const handleSubsetChange = (checked: boolean) => {
    onSettingsChange({
      ...settings,
      subset: checked ? 'favorites' : 'all'
    });
  };

  const handleFastModeChange = (checked: boolean) => {
    localStorage.setItem(FAST_MODE_STORAGE_KEY, String(checked));
    onSettingsChange({
      ...settings,
      fastMode: checked
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="bg-background/50 backdrop-blur-sm hover:bg-background/80"
          disabled={disabled}
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
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
              <p className="text-sm text-muted-foreground">Embaralha os cards a cada reinício</p>
            </div>
            <Switch 
              id="random-mode"
              checked={settings.mode === 'random'}
              onCheckedChange={handleModeChange}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="favorites-only" className="font-medium">Apenas Favoritos</Label>
              <p className="text-sm text-muted-foreground">Estude apenas os cards marcados com estrela</p>
            </div>
            <Switch 
              id="favorites-only"
              checked={settings.subset === 'favorites'}
              onCheckedChange={handleSubsetChange}
            />
          </div>

          {showFastMode && (
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
          )}
          
          <Button onClick={handleRestart} className="w-full" variant="default">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reiniciar Jogo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
