import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, RefreshCw } from "lucide-react";

export interface GameSettings {
  mode: 'sequential' | 'random';
  subset: 'all' | 'favorites';
}

interface GameSettingsModalProps {
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
  onRestart: () => void;
  disabled?: boolean;
}

export const GameSettingsModal: React.FC<GameSettingsModalProps> = ({ 
  settings, 
  onSettingsChange, 
  onRestart,
  disabled = false 
}) => {
  const [open, setOpen] = React.useState(false);

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
          
          <Button onClick={handleRestart} className="w-full" variant="default">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reiniciar Jogo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
