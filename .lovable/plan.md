
# Estabilização CLARA MASTER — Plano de Execução

Entrega focada em fluidez, recuperação e redução de tarefas globais. Cada fase é commit-sized, reversível, com testes e evidência. Nada de redesign, nada de migrations de cards, nada de alterar Favoritos/Especiais/Lista Vermelha.

## Princípios desta entrega

- Mudanças mínimas, verticais, testadas.
- Shell sempre vivo. Erros e suspense isolados ao conteúdo da rota.
- Auth com fonte única. Providers privados só em rotas privadas.
- Watchdog conservador. Safe Mode reativo, sem polling.
- Prefetch sob intenção.
- Cada fase só avança após typecheck + testes + smoke real no preview.

## Baseline (Fase 0, obrigatória)

Antes de qualquer alteração comportamental:

- `docs/FLUIDITY_STABILITY_REPORT.md` com SHA, BUILD_ID, tamanho de chunks, tempos de boot/navegação, long tasks, erros recentes.
- `src/lib/runtimePerformance.ts`: PerformanceObserver (longtask), navigation/resource timing, marks/measures, visibilitychange, pageshow/pagehide. Buffer em memória (últimas 50), flush em `requestIdleCallback`. Nunca registra tokens, e-mails, conteúdo de cards.
- Executar `typecheck`, `test`, `lint`, `build` e gravar saída real no relatório.

## Fase 1 — Isolar erros e suspense por rota

Problema: `LazyErrorBoundary` + `Suspense` envolvem o `BrowserRouter` inteiro. Qualquer erro/chunk derruba shell e exige F5.

Mudanças:

- `SafeMode` permanece como último boundary global.
- Novo `RouteErrorBoundary` montado **dentro** do shell, ao redor do `Outlet`. Reset automático em mudança de `location.key`.
- Fallback dentro da área de conteúdo, com botões: Tentar novamente, Voltar, Dashboard (via `navigate`, nunca `window.location`).
- Chunk error: 1 retry controlado por sessionStorage `chunkRetry:${BUILD_ID}:${chunkId}`, sem limpar caches automaticamente, sem loop.
- Novo `RouteSuspense` com fallback atrasado (~150 ms) só na área de conteúdo. Header/tab bar/sidebar nunca somem.
- Testes: erro em rota A não derruba shell; chunk lento mostra skeleton; chunk rápido não pisca.

## Fase 2 — Transição de página segura

Problema: antiga `PageTransition` retinha `children` em state → React #300.

Mudanças:

- Wrapper simples com `key={location.pathname}`, sem retenção de árvore anterior, sem dupla renderização.
- CSS-only: `opacity` + `translateY(5px)`, 160 ms, respeita `prefers-reduced-motion`, `PerformanceContext.animations`, Safe Mode.
- Aplicado **só** ao conteúdo da rota, não ao GlobalLayout.
- View Transition API só como progressive enhancement, fora de Study/jogos.

## Fase 3 — Freeze watchdog conservador + Safe Mode reativo

Problema: watchdog gera falso positivo em aba escondida/suspensão; Safe Mode é polled.

Mudanças em `useFreezeWatchdog`:

- `performance.now()` em vez de `Date.now()`.
- Ignora completamente `document.visibilityState !== 'visible'`.
- Reset em `visibilitychange→visible` e `pageshow`.
- 1 atraso de timer = `suspected_stall` (registra apenas). Auto Safe Mode **desativado** nesta entrega; banner apenas sugere ao usuário.
- Long tasks reais via PerformanceObserver são a evidência principal.

Safe Mode reativo:

- `SafeModeStore` com `useSyncExternalStore`.
- `AppRecoveryBanner` deixa de fazer `setInterval(5s)`; consome a store.
- `enable()/disable()` atualiza consumidores sem F5.

## Fase 4 — Autenticação centralizada

Auditar e ajustar para que `AuthProvider` seja a única autoridade global:

- `InstitutionProvider`: consome `useAuth()`, remove `onAuthStateChange` próprio e `getSession`. Reseta em logout.
- `EconomyProvider`: consome `useAuth()`. `refreshBalance` recebe `userId`/token; nada de `getSession` na carga inicial nem antes do realtime. 1 canal por userId, fechamento em troca/logout. `AbortController` para corridas.
- `useAuthUser`: marcado deprecated; cada call site migrado em PRs futuros (não nesta entrega; apenas mapeado).
- Teste vitest: contar assinaturas globais `onAuthStateChange` = 1.

## Fase 5 — PublicShell vs PrivateShell

Hoje providers privados (Economy, Institution) montam em landing/auth/SEO/portal.

Mudanças:

- `PublicShell`: landing, SEO, `/auth`, `/portal`. Sem Economy, Institution, heartbeat, notificações privadas.
- `PrivateShell`: requer sessão; monta Economy + Institution + GlobalLayout + heartbeat + notificações.
- Componentes desnecessários **não** são montados (não basta early return).
- `AppRoutes` reorganiza apenas o aninhamento; URLs e nomes de rota inalterados.

## Fase 6 — Prefetch por intenção + redução de tarefas globais

- Remover/limitar `prefetchCommonRoutes` (cinco imports em lote).
- `PrefetchLink`: `onPointerEnter` / `onFocus` / `onTouchStart`, dedup, respeita `saveData`, `connection.effectiveType`, `deviceMemory`, Safe Mode.
- `GoogleConnectPrompt` e `BrowserCheck`: lazy + montados só em PrivateShell.
- Avaliar consolidação Toaster/Sonner (manter ambos se houver consumidor; só remover com prova).
- `AppLifecycleCoordinator` leve: publica `visible/hidden/online/offline/pageshow/pagehide`. Cada serviço se inscreve, deduplica, escalona. Não é God Object.

## Fase 7 — Validação obrigatória

- Atualizar script `check`: `"check": "npm run typecheck && npm run test && npm run lint && npm run build"`.
- Rodar e colar saída real no `FLUIDITY_STABILITY_REPORT.md`.
- Smoke manual (desktop + mobile viewport): 20 navegações rápidas, aba escondida 1 min, voltar/avançar, erro controlado de rota, chunk lento simulado. Registrar long tasks/erros/requests.

## Critérios de aceitação

- Erro de página não exige F5.
- Shell nunca desaparece em navegação ou suspense.
- Aba escondida e `pageshow` não disparam freeze.
- Rota pública não inicializa Economy/Institution.
- Uma única assinatura global de auth.
- Prefetch dedicado por intenção; nenhum lote de 5 imports.
- Safe Mode reativo sem polling.
- Study não perde estado.
- Zero alteração em Favoritos/Especiais/Lista Vermelha/`status_group_uid`.
- `typecheck`, `test`, `lint`, `build` verdes com saída anexada.

## Forma de entrega

Vou propor **uma fase por turno**, apresentando ao final de cada uma: arquivos alterados, diff conceitual, saída real dos testes, próximos passos. Você aprova cada fase antes da seguinte. Rollback de qualquer fase é git revert do commit correspondente.

## Confirmação que preciso

1. Aprova o plano em 7 fases nesta ordem?
2. Posso começar pela **Fase 0 (Baseline + instrumentação)** agora?
3. Algum bloqueio quanto a tocar `App.tsx`, `LazyErrorBoundary`, `useFreezeWatchdog`, `AppRecoveryBanner`, `InstitutionProvider`, `EconomyProvider`, `prefetchCommonRoutes`?
