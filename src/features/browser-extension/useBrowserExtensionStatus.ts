import { useCallback, useEffect, useRef, useState } from "react";
import type { ExtensionStatus } from "./extensionConfig";
import {
  detectExtensionCompatibility,
  resolveExtensionStatus,
} from "./extensionStatus";
import { getWindowObject, readCompatibilityEnvironment } from "./extensionRuntime";

export interface BrowserExtensionStatus {
  status: ExtensionStatus;
  refresh: () => void;
}

/**
 * Status da extensão no navegador atual.
 *
 * - "unsupported": navegador fora do alvo (Firefox/Safari/mobile) — decidido
 *   por sinais do navegador, NUNCA pela ausência de chrome.runtime
 * - "unknown": ainda verificando
 * - "installed" / "missing": resultado do ping (canal ausente, erro ou timeout
 *   contam como "missing": é exatamente o caso de quem ainda não instalou)
 *
 * Consulta sempre que montado: não existe mais superfície "autenticada" como
 * pré-condição (a landing pública também precisa saber o status).
 *
 * Revalida ao voltar o foco para a janela — depois de instalar, o convite
 * desaparece sem exigir reload.
 */
export function useBrowserExtensionStatus(): BrowserExtensionStatus {
  const [status, setStatus] = useState<ExtensionStatus>(() =>
    detectExtensionCompatibility(readCompatibilityEnvironment()) ? "unknown" : "unsupported",
  );
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    resolveExtensionStatus()
      .then((next) => {
        if (!mountedRef.current || requestIdRef.current !== requestId) return;
        setStatus(next);
      })
      .catch(() => {
        if (!mountedRef.current || requestIdRef.current !== requestId) return;
        setStatus("missing");
      });
  }, []);

  useEffect(() => {
    refresh();

    const win = getWindowObject();
    const doc = typeof document === "undefined" ? undefined : document;
    const onFocus = () => refresh();
    const onVisibilityChange = () => {
      if (doc?.visibilityState === "hidden") return;
      refresh();
    };

    win?.addEventListener?.("focus", onFocus);
    doc?.addEventListener?.("visibilitychange", onVisibilityChange);

    return () => {
      win?.removeEventListener?.("focus", onFocus);
      doc?.removeEventListener?.("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  return { status, refresh };
}
