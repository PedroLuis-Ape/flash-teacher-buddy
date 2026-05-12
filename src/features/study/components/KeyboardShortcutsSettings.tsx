import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Keyboard, RotateCcw } from "lucide-react";
import {
  KEYBOARD_ACTIONS,
  CLASSIC_PRESET,
  GAMER_PRESET,
  DEFAULT_SHORTCUTS,
  loadShortcuts,
  saveShortcuts,
  resetShortcuts,
  loadPreset,
  savePreset,
  findConflicts,
  normalizeKey,
  keyLabel,
  type ShortcutActionId,
  type ShortcutMap,
  type PresetId,
} from "@/features/study/lib/keyboardShortcuts";

export function KeyboardShortcutsSettings() {
  const { toast } = useToast();
  const [map, setMap] = useState<ShortcutMap>(() => loadShortcuts());
  const [preset, setPreset] = useState<PresetId>(() => loadPreset());
  const [capturing, setCapturing] = useState<ShortcutActionId | null>(null);
  const [pendingChange, setPendingChange] = useState<{
    id: ShortcutActionId;
    key: string;
    conflicts: ShortcutActionId[];
  } | null>(null);

  // Capture next keypress when "Alterar" is clicked
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(null);
        return;
      }
      const key = normalizeKey(e.key);
      const conflicts = findConflicts(map, key, capturing);
      if (conflicts.length > 0) {
        setPendingChange({ id: capturing, key, conflicts });
      } else {
        applyChange(capturing, key, false);
      }
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, map]);

  function applyChange(id: ShortcutActionId, key: string, clearOthers: boolean) {
    const next: ShortcutMap = { ...map, [id]: key };
    if (clearOthers) {
      (Object.keys(next) as ShortcutActionId[]).forEach((k) => {
        if (k !== id && normalizeKey(next[k]) === normalizeKey(key)) {
          next[k] = "";
        }
      });
    }
    setMap(next);
    saveShortcuts(next);
    setPreset("custom");
    savePreset("custom");
    toast({ title: "Atalho atualizado", description: `${labelOf(id)}: ${keyLabel(key)}` });
  }

  function applyPreset(p: PresetId) {
    setPreset(p);
    savePreset(p);
    if (p === "classic") {
      setMap(CLASSIC_PRESET);
      saveShortcuts(CLASSIC_PRESET);
    } else if (p === "gamer") {
      setMap(GAMER_PRESET);
      saveShortcuts(GAMER_PRESET);
    }
  }

  function handleReset() {
    const fresh = resetShortcuts();
    setMap(fresh);
    setPreset("classic");
    savePreset("classic");
    toast({ title: "Atalhos restaurados ao padrão" });
  }

  function labelOf(id: ShortcutActionId): string {
    return KEYBOARD_ACTIONS.find((a) => a.id === id)?.label ?? id;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Atalhos de Teclado
          </CardTitle>
          <CardDescription>
            Configure quais teclas executam cada ação nos modos de estudo.
            Os atalhos não são acionados enquanto você digita em campos de texto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Preset:</span>
              <Select value={preset} onValueChange={(v) => applyPreset(v as PresetId)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Padrão clássico</SelectItem>
                  <SelectItem value="gamer">Padrão gamer / WASD</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar padrão
            </Button>
          </div>

          <div className="divide-y rounded-md border">
            {KEYBOARD_ACTIONS.map((action) => (
              <div
                key={action.id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium">{action.label}</div>
                  <div className="text-xs text-muted-foreground">{action.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="min-w-[3rem] justify-center text-sm">
                    {map[action.id] ? keyLabel(map[action.id]) : "—"}
                  </Badge>
                  <Button
                    size="sm"
                    variant={capturing === action.id ? "default" : "outline"}
                    onClick={() => setCapturing(action.id)}
                  >
                    {capturing === action.id ? "Pressione uma tecla…" : "Alterar"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!capturing} onOpenChange={(o) => !o && setCapturing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pressione uma tecla</DialogTitle>
            <DialogDescription>
              Pressione a tecla que deseja usar para “{capturing ? labelOf(capturing) : ""}”.
              Pressione Esc para cancelar.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingChange} onOpenChange={(o) => !o && setPendingChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tecla já em uso</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange ? (
                <>
                  A tecla <b>{keyLabel(pendingChange.key)}</b> já está atribuída a:{" "}
                  <b>{pendingChange.conflicts.map(labelOf).join(", ")}</b>.
                  Deseja substituir e remover essa atribuição anterior?
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingChange(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingChange) applyChange(pendingChange.id, pendingChange.key, true);
                setPendingChange(null);
              }}
            >
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default KeyboardShortcutsSettings;