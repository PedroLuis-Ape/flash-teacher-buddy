import { APP_BUILD_COMMIT, APP_BUILD_ID, APP_VERSION } from "@/lib/versionManager";
import { formatBuildTimestamp } from "@/lib/runtimeIncident";

export default function PreviewHealth() {
  return (
    <main
      data-testid="preview-health"
      data-health-status="ok"
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
        aria-labelledby="preview-health-title"
        style={{
          width: "min(560px, 100%)",
          border: "1px solid rgba(181,91,255,.45)",
          borderRadius: 18,
          background: "#100526",
          padding: 28,
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, color: "#75f0a1", fontWeight: 800, letterSpacing: ".04em" }}>
          STATUS: OK
        </p>
        <h1 id="preview-health-title" style={{ fontSize: 26, margin: "10px 0 18px" }}>
          App Piteco Preview: OK
        </h1>
        <dl style={{ display: "grid", gap: 10, margin: 0, textAlign: "left" }}>
          <div>
            <dt style={{ color: "#c9bed8", fontSize: 13 }}>Versão</dt>
            <dd style={{ margin: 0, fontWeight: 700 }}>v{APP_VERSION}</dd>
          </div>
          <div>
            <dt style={{ color: "#c9bed8", fontSize: 13 }}>Commit</dt>
            <dd data-testid="preview-health-commit" style={{ margin: 0, fontWeight: 700, wordBreak: "break-all" }}>
              {APP_BUILD_COMMIT}
            </dd>
          </div>
          <div>
            <dt style={{ color: "#c9bed8", fontSize: 13 }}>Build</dt>
            <dd data-testid="preview-health-build" style={{ margin: 0, fontWeight: 700 }}>
              {formatBuildTimestamp()} ({APP_BUILD_ID})
            </dd>
          </div>
        </dl>
        <p style={{ color: "#c9bed8", fontSize: 13, lineHeight: 1.5, margin: "20px 0 0" }}>
          Esta rota não consulta o Supabase, não usa sessão e serve apenas para validar a montagem do preview.
        </p>
      </section>
    </main>
  );
}
