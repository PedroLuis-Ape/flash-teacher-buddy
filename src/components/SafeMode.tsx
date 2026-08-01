import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearErrorBurst } from "@/lib/errorCapture";
import { createTechnicalIncident, logTechnicalIncident, type TechnicalIncident } from "@/lib/runtimeIncident";

interface ZombieDetail {
  reason?: string;
  severity?: "fatal-sync";
  source?: string;
}

interface SafeModeState {
  hasError: boolean;
  error: Error | null;
  incident: TechnicalIncident | null;
  zombieDetected: boolean;
  copied: boolean;
}

const CRASH_KEY = "ape_last_crash";
const CRASH_COUNT_KEY = "ape_crash_count";

export class SafeMode extends Component<{ children: ReactNode }, SafeModeState> {
  state: SafeModeState = {
    hasError: false,
    error: null,
    incident: null,
    zombieDetected: false,
    copied: false,
  };

  private zombieHandler = ((event: Event) => {
    const detail = (event as CustomEvent<ZombieDetail>).detail;
    if (detail?.severity !== "fatal-sync") return;

    const error = new Error(detail.reason || "Repeated synchronous runtime errors");
    const incident = createTechnicalIncident(error, detail.source || "safe-mode");
    logTechnicalIncident("SafeMode", incident);
    this.setState({ hasError: true, error, incident, zombieDetected: true, copied: false });
  }) as EventListener;

  componentDidMount() {
    window.addEventListener("ape-zombie-state", this.zombieHandler);
  }

  componentWillUnmount() {
    window.removeEventListener("ape-zombie-state", this.zombieHandler);
  }

  static getDerivedStateFromError(error: Error): Partial<SafeModeState> {
    return { hasError: true, error, copied: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const incident = createTechnicalIncident(error, info?.componentStack || "");
    logTechnicalIncident("SafeMode", incident);

    try {
      localStorage.setItem(
        CRASH_KEY,
        JSON.stringify({
          incidentId: incident.id,
          route: incident.route,
          version: incident.version,
          buildId: incident.buildId,
          errorName: incident.errorName,
          domain: incident.domain,
          time: Date.now(),
        }),
      );
      const count = Number.parseInt(localStorage.getItem(CRASH_COUNT_KEY) || "0", 10);
      localStorage.setItem(CRASH_COUNT_KEY, String(Number.isFinite(count) ? count + 1 : 1));
    } catch {
      // Local diagnostics are best effort and never block recovery.
    }

    this.setState({ incident });
  }

  handleRetry = () => {
    clearErrorBurst();
    this.setState({ hasError: false, error: null, incident: null, zombieDetected: false, copied: false });
  };

  handleReload = () => {
    clearErrorBurst();
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = "/";
  };

  handleCopyIncident = async () => {
    const id = this.state.incident?.id;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      this.setState({ copied: true });
    } catch {
      this.setState({ copied: false });
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const incidentId = this.state.incident?.id || "APE-RECOVERY-PENDING";
    const buttonStyle = {
      padding: "12px 16px",
      borderRadius: 10,
      border: "1px solid rgba(181,91,255,.55)",
      background: "transparent",
      color: "#fff",
      fontWeight: 700,
      fontSize: 14,
      cursor: "pointer",
    } as const;

    return (
      <main
        role="alert"
        aria-live="assertive"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          fontFamily: "Nunito, system-ui, sans-serif",
          background: "#09001f",
          color: "#fff",
        }}
      >
        <section
          style={{
            maxWidth: 520,
            width: "100%",
            textAlign: "center",
            background: "#100526",
            border: "1px solid rgba(181,91,255,.45)",
            borderRadius: 18,
            padding: "32px 24px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <p style={{ color: "#ffca70", fontWeight: 800, margin: 0 }}>Modo de recuperação</p>
          <h1 style={{ fontSize: 24, margin: "10px 0" }}>Não foi possível carregar esta tela.</h1>
          <p style={{ color: "#d8cfe2", lineHeight: 1.55, margin: "0 0 18px" }}>
            O erro foi isolado para proteger o restante do preview. Nenhum dado de conta ou card é exibido nesta tela.
          </p>
          <p style={{ color: "#c9bed8", fontSize: 13, margin: "0 0 20px", wordBreak: "break-word" }}>
            Identificador técnico: <code>{incidentId}</code>
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
            <button type="button" onClick={this.handleRetry} style={{ ...buttonStyle, border: 0, background: "#7c3aed" }}>
              Tentar novamente
            </button>
            <button type="button" onClick={this.handleReload} style={buttonStyle}>
              Recarregar o aplicativo
            </button>
            <button type="button" onClick={this.handleHome} style={buttonStyle}>
              Voltar ao início
            </button>
            <button type="button" onClick={() => void this.handleCopyIncident()} style={buttonStyle}>
              {this.state.copied ? "Identificador copiado" : "Copiar identificador técnico"}
            </button>
          </div>
        </section>
      </main>
    );
  }
}
