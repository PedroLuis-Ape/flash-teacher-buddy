import type { RuntimeDiagnostic } from "@/lib/runtimeDiagnostics";

export function BootstrapDiagnostics({ diagnostic }: { diagnostic: RuntimeDiagnostic }) {
  const incidentId = `APE-CONFIG-${diagnostic.code}`;

  const copyIncident = async () => {
    try {
      await navigator.clipboard.writeText(incidentId);
    } catch {
      // Clipboard access is optional; the identifier remains visible.
    }
  };

  return (
    <main
      data-testid="bootstrap-diagnostics"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#09001f",
        color: "#fff",
        fontFamily: "Nunito, system-ui, sans-serif",
      }}
    >
      <section
        role="alert"
        style={{
          width: "min(560px, 100%)",
          border: "1px solid rgba(255,102,102,.5)",
          borderRadius: 18,
          background: "#180a21",
          padding: 28,
        }}
      >
        <p style={{ margin: 0, color: "#ff8b8b", fontWeight: 800 }}>Diagnóstico do bootstrap</p>
        <h1 style={{ fontSize: 24, margin: "10px 0" }}>Não foi possível iniciar o preview.</h1>
        <p style={{ color: "#e1d8e8", lineHeight: 1.55 }}>{diagnostic.message}</p>
        <p style={{ color: "#e1d8e8", lineHeight: 1.55 }}>
          <strong>Ação recomendada:</strong> {diagnostic.action}
        </p>
        <p style={{ color: "#c9bed8", fontSize: 13 }}>
          Identificador técnico: <code>{incidentId}</code>
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ border: 0, borderRadius: 10, padding: "11px 16px", background: "#7c3aed", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = "/"; }}
            style={{ border: "1px solid #775a8f", borderRadius: 10, padding: "11px 16px", background: "transparent", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            Voltar ao início
          </button>
          <button
            type="button"
            onClick={() => void copyIncident()}
            style={{ border: "1px solid #775a8f", borderRadius: 10, padding: "11px 16px", background: "transparent", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            Copiar identificador técnico
          </button>
        </div>
      </section>
    </main>
  );
}
