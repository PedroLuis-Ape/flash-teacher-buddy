/**
 * Seção "Extensão do navegador" em Configurações/Preferências (Perfil).
 *
 * Mostra o status real (ping) e, quando a extensão não está instalada, o botão
 * que abre a Chrome Web Store em nova aba. Sem página nova, sem Supabase.
 */

import { Puzzle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WEB_STORE_URL } from "./extensionConfig";
import { useBrowserExtensionStatus } from "./useBrowserExtensionStatus";

export function BrowserExtensionSettingsSection() {
  const { status, refresh } = useBrowserExtensionStatus();

  const statusLabel =
    status === "installed"
      ? "Instalada"
      : status === "unknown"
        ? "Verificando…"
        : status === "unsupported"
          ? "Indisponível neste navegador"
          : "Não instalada";

  const detail =
    status === "installed"
      ? "A extensão está ativa neste navegador."
      : status === "unsupported"
        ? "A extensão funciona no Chrome e no Edge para computador."
        : "Ouça pronúncia e salve trechos de qualquer página no APE.";

  return (
    <Card className="rounded-3xl border-primary/10 p-3 shadow-sm sm:p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Puzzle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Extensão do navegador</p>
          <p className="text-sm text-muted-foreground">{detail}</p>
          <p className="mt-1 text-sm font-medium">
            Status: <span data-testid="extension-status">{statusLabel}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          className="min-h-[44px] w-full justify-center"
          onClick={refresh}
          disabled={status === "unsupported"}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Verificar novamente
        </Button>

        {status !== "installed" && status !== "unsupported" && (
          <Button asChild className="min-h-[44px] w-full justify-center">
            <a href={WEB_STORE_URL} target="_blank" rel="noopener noreferrer">
              Instalar extensão
            </a>
          </Button>
        )}
      </div>
    </Card>
  );
}

export default BrowserExtensionSettingsSection;
