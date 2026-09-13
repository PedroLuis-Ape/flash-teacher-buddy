/**
 * Montagem ÚNICA do convite da extensão "Salvar nas Notas" em toda a aplicação.
 *
 * O `GlobalLayout` renderiza este componente uma vez; ele resolve a superfície
 * atual (landing pública SEM login ou app autenticado) e delega a elegibilidade
 * ao próprio convite. Não montar o convite em `PublicShell`/`PrivateShell`:
 * isso reintroduziria duas instâncias concorrentes e o gate de autenticação.
 */

import { Suspense, lazy } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeMode } from "@/lib/safeMode";
import { resolveExtensionPromptSurface } from "./extensionPromptPolicy";

const ExtensionInstallPrompt = lazy(() =>
  import("./ExtensionInstallPrompt").then((m) => ({ default: m.ExtensionInstallPrompt })),
);

export function BrowserExtensionPromptMount() {
  const { pathname } = useLocation();
  const { status } = useAuth();
  const safeMode = useSafeMode();
  const authenticatedSession = status === "authenticated";

  const surface = resolveExtensionPromptSurface({
    pathname,
    authenticatedSession,
    safeMode,
  });

  if (!surface) return null;

  return (
    <Suspense fallback={null}>
      <ExtensionInstallPrompt route={pathname} authenticatedSession={authenticatedSession} />
    </Suspense>
  );
}

export default BrowserExtensionPromptMount;

