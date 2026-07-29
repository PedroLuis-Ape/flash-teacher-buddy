import "@/index.css";
import "@/styles/space-ui-v1.css";
import "@/styles/space-ui-components.css";
import "@/styles/space-ui-widgets.css";
import "@/styles/space-ui-reference-match.css";
import "@/styles/piteco-play-private.css";

const params = new URLSearchParams(window.location.search);
const baseline = params.get("baseline") === "1";
const target = params.get("target") === "library" ? "library" : "home";

document.documentElement.classList.add("dark");
document.documentElement.dataset.visualStyle = "playful";
document.documentElement.dataset.palette = "black";

const shellClass = baseline
  ? "space-ui space-ui-shell"
  : "ape-private-shell space-ui space-ui-shell";

const homeMarkup = `
  <section class="ape-private-home min-h-screen bg-background pb-24">
    <header class="space-ui-pagebar sticky top-0 z-40 bg-background border-b border-border">
      <div class="container mx-auto flex h-14 items-center justify-between px-3">
        <h1 class="text-lg font-semibold">Início</h1>
        <button class="h-11 min-w-11 rounded-xl border border-border" aria-label="Pesquisar">⌕</button>
      </div>
    </header>
    <div class="ape-private-home-content mx-auto max-w-[1600px] space-y-6 px-4 pt-4">
      <article class="ape-home-welcome welcome-banner border-0">
        <div class="p-5">
          <div class="flex items-center gap-4">
            <div class="h-14 w-14 shrink-0 rounded-full bg-primary"></div>
            <div><h2 class="text-xl font-bold">Olá!</h2><p class="text-sm text-muted-foreground">Continue aprendendo.</p></div>
          </div>
        </div>
      </article>
      <div class="ape-home-stats grid grid-cols-2 gap-3">
        ${["PTS semanais", "PiteCOIN", "Nível", "Sequência", "Listas"].map((label, index) => `
          <article class="ape-home-stat stat-tile p-4 border-0">
            <div class="mb-2 flex items-center gap-2"><span class="icon-tile flex h-9 w-9 items-center justify-center">●</span><span class="text-xs text-muted-foreground">${label}</span></div>
            <p class="text-3xl font-bold">${index + 1}</p>
          </article>
        `).join("")}
      </div>
      <div class="ape-home-feature-grid grid grid-cols-1 gap-3">
        ${["Continuar estudando", "Biblioteca", "Modo Reino"].map((label) => `
          <article class="ape-home-feature-card border border-border bg-card">
            <div class="p-5"><h3 class="font-semibold">${label}</h3><p class="mt-1 text-sm text-muted-foreground">Estado visual local para validação.</p></div>
          </article>
        `).join("")}
      </div>
      <div class="ape-home-quick-actions space-y-4">
        <h2 class="text-lg font-bold">Atalhos</h2>
        <div class="grid grid-cols-2 gap-3">
          ${["Biblioteca", "Nova lista", "Metas", "Notas"].map((label) => `
            <button class="ape-home-quick-card border border-border bg-card p-5 text-left"><h3 class="font-semibold">${label}</h3></button>
          `).join("")}
        </div>
      </div>
    </div>
  </section>
`;

const libraryMarkup = `
  <section class="ape-private-library min-h-screen bg-background">
    <header class="space-ui-pagebar sticky top-0 z-40 bg-background border-b border-border">
      <div class="container mx-auto flex h-14 items-center px-3"><h1 class="text-lg font-semibold">Biblioteca</h1></div>
    </header>
    <div class="ape-private-library-content mx-auto max-w-6xl px-4">
      <div class="ape-tabs-shell w-full">
        <div class="sticky top-14 z-30 grid grid-cols-3 border-b border-border bg-background">
          ${["Pastas", "Favoritas", "Professores"].map((label, index) => `
            <button role="tab" data-state="${index === 0 ? "active" : "inactive"}" class="h-12 border-b-2">${label}</button>
          `).join("")}
        </div>
        <div class="ape-library-tab space-y-3 p-4">
          <div class="ape-library-toolbar flex items-center gap-2 py-1">
            <button class="min-h-11 rounded-xl border border-border px-3">Selecionar</button>
            <button class="min-h-11 rounded-xl bg-primary px-3 text-primary-foreground">Nova pasta</button>
          </div>
          <div class="grid grid-cols-1 gap-3">
            ${["Conteúdo A", "Conteúdo B", "Conteúdo C"].map((label, index) => `
              <div class="flex items-center gap-2">
                <button class="space-ui-folder-card ape-card-row flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left">
                  <span class="space-ui-card-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border">📁</span>
                  <span class="min-w-0"><strong class="ape-card-title block">${label}</strong><small class="text-muted-foreground">${index + 1} listas</small></span>
                </button>
                <button class="h-11 w-11 shrink-0 rounded-xl border border-border" aria-label="Ação">•••</button>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
  </section>
`;

document.querySelector<HTMLDivElement>("#root")!.innerHTML = `
  <div class="${shellClass} min-h-screen flex flex-col">
    <header class="space-ui-header sticky top-0 z-50 border-b bg-background">
      <div class="flex h-12 items-center justify-between px-3"><strong>APE</strong><span>v1.5</span></div>
    </header>
    <div class="space-ui-app-frame flex min-w-0 flex-1 items-start">
      <main class="space-ui-main min-w-0 flex-1">${target === "library" ? libraryMarkup : homeMarkup}</main>
    </div>
    <nav class="space-ui-tabbar fixed inset-x-0 bottom-0 z-50 border-t bg-background">
      <div class="flex h-[4.5rem] items-center justify-around px-2">
        ${["Início", "Biblioteca", "Metas", "Loja", "Perfil"].map((label, index) => `
          <button class="space-ui-tab ${index === (target === "home" ? 0 : 1) ? "space-ui-tab-active" : ""} flex min-w-[54px] flex-col items-center justify-center rounded-2xl px-1 text-xs">
            <span aria-hidden>●</span><span>${label}</span>
          </button>
        `).join("")}
      </div>
    </nav>
  </div>
`;
