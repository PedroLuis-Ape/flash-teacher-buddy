import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  cleanupAppOwnedCaches,
  unregisterLegacyAppServiceWorkers,
} from "@/lib/appCacheCleanup";
import { clearErrorBurst } from "@/lib/errorCapture";

const CRASH_KEY = "ape_last_crash";
const CRASH_COUNT_KEY = "ape_crash_count";
const PRESERVE_STORAGE_PREFIXES = [
  "sb-",
  "ape_outbox_",
  "ape_pref_",
  "app-piteco:",
  "study-",
] as const;
const PRESERVE_STORAGE_KEYS = new Set(["theme", "i18nextLng"]);

interface ZombieDetail {
  reason?: string;
  severity?: "fatal-sync";
  source?: string;
}

interface SafeModeState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
  zombieDetected: boolean;
}

function shouldPreserveStorageKey(key: string): boolean {
  return PRESERVE_STORAGE_KEYS.has(key)
    || PRESERVE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export class SafeMode extends Component<{ children: ReactNode }, SafeModeState> {
  state: SafeModeState = {
    hasError: false,
    error: null,
    errorInfo: "",
    zombieDetected: false,
  };

  private zombieHandler = ((event: Event) => {
    const detail = (event as CustomEvent<ZombieDetail>).detail;
    if (detail?.severity !== "fatal-sync") {
      console.warn("[SafeMode] Ignored non-fatal zombie event:", detail);
      return;
    }

    this.setState({
      hasError: true,
      zombieDetected: true,
      error: new Error(detail.reason || "App entered recovery mode"),
      errorInfo: "SafeMode detected repeated fatal synchronous errors.",
    });
  }) as EventListener;

  componentDidMount() {
    window.addEventListener("ape-zombie-state", this.zombieHandler);
  }

  componentWillUnmount() {
    window.removeEventListener("ape-zombie-state", this.zombieHandler);
  }

  static getDerivedStateFromError(error: Error): Partial<SafeModeState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const message = `${error.message || "Unknown error"}\n${info.componentStack?.slice(0, 500) || ""}`;
    this.setState({ errorInfo: message });

    try {
      localStorage.setItem(CRASH_KEY, JSON.stringify({
        message: error.message,
        stack: error.stack?.slice(0, 800),
        time: Date.now(),
      }));
      const count = Number.parseInt(localStorage.getItem(CRASH_COUNT_KEY) || "0", 10);
      localStorage.setItem(CRASH_COUNT_KEY, String(count + 1));
    } catch {
      // Best-effort diagnostics only.
    }

    console.error("[SafeMode] Fatal React error caught:", error, info);
  }

  handleRetry = () => {
    clearErrorBurst();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: "",
      zombieDetected: false,
    });
  };

  handleReload = () => {
    clearErrorBurst();
    window.location.reload();
  };

  handleClearAndReload = async () => {
    try {
      const removableKeys: string[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && !shouldPreserveStorageKey(key)) removableKeys.push(key);
      }
      removableKeys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Continue cleaning the remaining keys.
        }
      });

      await Promise.allSettled([
        unregisterLegacyAppServiceWorkers(),
        cleanupAppOwnedCaches(),
      ]);

      sessionStorage.clear();
    } catch (error) {
      console.warn("[SafeMode] Falha ao limpar cache:", error);
    }

    window.location.href = `${window.location.origin}/?t=${Date.now()}`;
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isZombie = this.state.zombieDetected;
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "#1a1a2e",
        color: "#e0e0e0",
      }}>
        <div style={{
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
          background: "#16213e",
          borderRadius: 16,
          padding: "32px 24px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#FFD700" }}>
            Modo Recuperação
          </h1>
          <p style={{ fontSize: 14, color: "#aaa", marginBottom: 20 }}>
            {isZombie
              ? "A interface detectou um erro fatal repetido e entrou em recuperação."
              : "Ocorreu um erro fatal ao renderizar o aplicativo."}
          </p>

          {this.state.error && (
            <pre style={{
              background: "#0f0f23",
              color: "#ff6b6b",
              padding: 12,
              borderRadius: 8,
              fontSize: 11,
              textAlign: "left",
              maxHeight: 120,
              overflow: "auto",
              marginBottom: 20,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {this.state.error.message}
            </pre>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button type="button" onClick={this.handleRetry} style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "none",
              background: "#4CAF50",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}>
              ⚡ Tentar recuperar
            </button>
            <button type="button" onClick={this.handleReload} style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "none",
              background: "#FFD700",
              color: "#1a1a2e",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}>
              🔄 Recarregar
            </button>
            <button type="button" onClick={this.handleClearAndReload} style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "1px solid #555",
              background: "transparent",
              color: "#e0e0e0",
              fontWeight: 500,
              fontSize: 14,
              cursor: "pointer",
            }}>
              🧹 Limpar cache e reiniciar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
