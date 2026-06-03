import { useEffect, useState } from "react";
import {
  isSafeModeEnabled,
  enableSafeMode,
  disableSafeMode,
} from "@/lib/safeMode";
import { hasRecentFreeze } from "@/hooks/useFreezeWatchdog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";

/**
 * Discreet banner shown when:
 *  - a freeze was recorded in the last 5 minutes, OR
 *  - safe mode is currently enabled.
 */
export function AppRecoveryBanner() {
  const [safe, setSafe] = useState(false);
  const [freeze, setFreeze] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const update = () => {
      setSafe(isSafeModeEnabled());
      setFreeze(hasRecentFreeze());
    };
    update();
    const id = window.setInterval(update, 5000);
    return () => window.clearInterval(id);
  }, []);

  if (dismissed) return null;
  if (!safe && !freeze) return null;

  const handleEnableSafe = () => {
    enableSafeMode();
    setSafe(true);
  };
  const handleDisableSafe = () => {
    disableSafeMode();
    setSafe(false);
    window.location.reload();
  };
  const handleReload = () => window.location.reload();

  return (
    <div className="sticky top-0 z-[60] w-full bg-muted/90 border-b border-border text-xs">
      <div className="max-w-[1600px] mx-auto px-3 py-1.5 flex items-center gap-2 flex-wrap">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="text-muted-foreground flex-1 min-w-0">
          {safe
            ? "Modo seguro ativo — efeitos opcionais desligados."
            : "Detectamos um travamento recente. Se o app estiver lento, ative o modo seguro."}
        </span>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={handleReload}>
            Recarregar
          </Button>
          {safe ? (
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={handleDisableSafe}>
              Desativar
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={handleEnableSafe}>
              Modo seguro
            </Button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}