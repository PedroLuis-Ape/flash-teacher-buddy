import { loadOfficialPlatformRuntime } from "./integrations/supabase/runtimeBootstrap";
import { installPlatformRuntime } from "./integrations/supabase/platformRuntime";

async function boot() {
  installPlatformRuntime(await loadOfficialPlatformRuntime());
  await import("./main.tsx");
}

void boot().catch((error) => {
  console.error("[PlatformBootstrap]", error);
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#09001f;color:#fff;font-family:Nunito,system-ui,sans-serif">
      <section style="width:min(460px,100%);border:1px solid rgba(181,91,255,.45);border-radius:18px;background:#100526;padding:24px;text-align:center">
        <h1 style="font-size:20px;margin:0 0 10px">Não foi possível iniciar o App Piteco</h1>
        <p style="font-size:14px;line-height:1.5;color:#c9bed8;margin:0 0 18px">A configuração oficial não pôde ser validada.</p>
        <button type="button" onclick="window.location.reload()" style="border:0;border-radius:12px;padding:12px 18px;background:#7c3aed;color:#fff;font-weight:700;cursor:pointer">Tentar novamente</button>
      </section>
    </main>`;
});
