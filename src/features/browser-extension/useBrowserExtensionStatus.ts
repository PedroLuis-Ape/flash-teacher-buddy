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

interface UseBrowserExtensionStatusOptions {
  /** Só consulta a extensão quando true (ex.: usuário autenticado). */
  enabled?: boolean;
}

/**
 * Status da extensão no navegador atual.
 *
 * - "unsupported": sem canal externo (Firefox/Safari/mobile) ou mobile
 * - "unknown": ainda verificando
 * - "installed" / "missing": resultado do ping
 *
 * Revalida ao voltar o foco para a janela — depois de instalar, o convite
 * desaparece sem exigir reload.
 */
export function useBrowserExtensionStatus(
  options: UseBrowserExtensionStatusOptions = {},
): BrowserExtensionStatus {
  const enabled = options.enabled ?? true;
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
    if (!enabled) return;

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
  }, [enabled, refresh]);

  return { status, refresh };
}
