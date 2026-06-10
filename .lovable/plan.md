## Diagnóstico

O app tem várias fontes de instabilidade que se acumulam no boot:

1. **PWA contraditório**: `vite.config.ts` não tem mais VitePWA, mas `index.html` mantém manifest, `App.tsx` monta `InstallPWA`, `public/sw.js` ainda existe, e `main.tsx` + `versionManager.ts` fazem cleanup/reload agressivo a cada abertura — causando potencial loop de reload e cache imprevisível.
2. **Boot duplicado**: `versionManager.ts` é importado e executa side-effects no import (reload + cache clear), enquanto `main.tsx` faz o mesmo cleanup de SW. Duas fontes de reload competindo.
3. **Auth com risco de race**: `SessionWatcher` redireciona em qualquer evento, inclusive `INITIAL_SESSION` antes da hidratação consolidada. `useAuthUser` (não vi) pode chamar `getSession` em paralelo.
4. **Errors globais ruidosos**: `errorCapture.ts` salva toda promise rejection como crash, mesmo sabendo filtrar — `isIgnorablePromiseRejection` existe mas não é usada para gatear o `saveError`.
5. **Swipe global** ativo em rotas onde não deveria (study/games) — conflito com gestos internos.
6. **Safe Mode** é mais banner do que kill switch real: não desabilita heartbeat/prefetch/swipe automaticamente quando ativado.

## Plano de Estabilização (incremental, conservador)

### 1. PWA desligado de verdade
- `public/sw.js` → substituir por **kill-switch worker idempotente** (já está nesse formato, manter, mas garantir que `main.tsx` não re-registre).
- `index.html`: remover `<link rel="manifest">` e metatags `theme-color`/`apple-touch-icon` que sinalizam PWA instalável. Manter favicon.
- `App.tsx`: remover `<InstallPWA />` do render (manter o arquivo no repo, só não montar).
- `main.tsx`: **não** rodar `caches.keys()...delete` em todo boot. Mover essa limpeza para `bootStability.ts` com guard `sessionStorage` (uma vez por build).

### 2. Novo módulo `src/lib/bootStability.ts`
- Função `runBootStability()` única, idempotente, chamada uma vez de `main.tsx`.
- Detecta iframe/preview Lovable e **não** faz cleanup nesses contextos.
- Roda cleanup legado de SW + caches **apenas se** `localStorage.ape_boot_cleanup_build !== BUILD_ID`.
- Logs úteis (`[BootStability]`), sem reload automático.
- Expõe `isPreviewContext()` para outros módulos.

### 3. `versionManager.ts` neutralizado
- Manter `APP_VERSION`, `APP_BUILD_ID`, `formatVersionLabel()`.
- **Remover** o `checkAppBuildVersion()` que faz `window.location.reload()` no import. Substituir por função pura que retorna boolean (sem side-effect). O reload de nova build agora fica a cargo do `bootStability` (e mesmo lá, só limpa cache — sem reload forçado, deixa o usuário recarregar).

### 4. `main.tsx` simplificado
- Importa `bootStability` e chama `runBootStability()` antes de montar React.
- Remove bloco inline de SW cleanup e cache cleanup (movido).
- Mantém splash e progress bar.

### 5. Auth sem race
- `SessionWatcher`: já tem guard `initializedRef`, mas o redirect no `INITIAL_SESSION` sem sessão dispara antes do React Query hidratar. Ajustar para: no `INITIAL_SESSION`, se `!session` E rota é protegida, aguardar 1 tick (`setTimeout 0`) e re-checar `supabase.auth.getSession()` antes de navegar — evita falso negativo durante hidratação.
- Auditar `useAuthUser`: garantir um único `getSession` + uso do listener compartilhado (sem duplicar chamadas concorrentes).
- `EconomyInitializer`: gatear init com `isReady` do auth para não disparar antes da sessão.

### 6. Safe Mode kill-switch real
- `featureFlags.ts`: adicionar helper `isSafeMode()` que lê `ape_safe_mode` do localStorage e força flags falsy para `economy_enabled`, `heartbeat_enabled`, `swipe_navigation_enabled`, `present_inbox_visible`, `study_images_enabled`, `glossary_enabled`, `word_hints_enabled`.
- `useActivityHeartbeat`, `useSwipeNavigation`, `routePrefetch`, `InstallPWA` (caso volte), modais de present box: gatear com `isSafeMode()`.
- `AppRecoveryBanner`: adicionar botão "Sair do modo seguro" que limpa flag + reload manual.
- `useFreezeWatchdog`: quando detectar freezes repetidos, ativar `ape_safe_mode` automaticamente.

### 7. `errorCapture.ts` menos ruidoso
- `unhandledrejection`: usar `isIgnorablePromiseRejection` para **não** chamar `saveError` em falhas de network/abort.
- Throttle: `saveError` só escreve se `Date.now() - lastWrite > 1000ms`.
- Separar tipos via label (`network`, `chunk`, `supabase`, `render`).
- Detectar erros de chunk lazy (`ChunkLoadError`, `Loading chunk * failed`) e marcar separadamente — `LazyErrorBoundary` exibe fallback.

### 8. Swipe restrito
- `useSwipeNavigation`: adicionar lista negra de rotas — desativar se `pathname` começa com `/study`, `/games`, `/folders/`, `/collections/`, `/turmas/`.
- Já desativa via `isSafeMode()` também.

### 9. Build checks
- `package.json`: scripts `typecheck`, `check` (a Lovable já roda build).
- Rodar `tsc --noEmit` e `vitest` para validar sem regressão.

### 10. Não tocar
- Lógica de estudo, cards, favoritos, lista vermelha, gameCore, hooks de TTS, layout visual, rotas, schema de DB.

## Arquivos a alterar

**Novos:**
- `src/lib/bootStability.ts`

**Editar:**
- `src/main.tsx` (simplificar)
- `src/lib/versionManager.ts` (remover side-effect de reload)
- `src/App.tsx` (remover InstallPWA do render)
- `index.html` (remover manifest link e metatags PWA)
- `src/components/SessionWatcher.tsx` (guard de hidratação)
- `src/components/EconomyInitializer.tsx` (gatear por auth ready)
- `src/lib/errorCapture.ts` (filtrar + throttle)
- `src/hooks/useSwipeNavigation.ts` (blacklist + safe mode)
- `src/hooks/useActivityHeartbeat.ts` (gatear por safe mode)
- `src/lib/routePrefetch.ts` (gatear por safe mode)
- `src/lib/featureFlags.ts` (helper `isSafeMode` + overrides)
- `src/components/AppRecoveryBanner.tsx` (botão sair safe mode)
- `src/hooks/useFreezeWatchdog.ts` (auto-ativar safe mode)
- `src/components/SafeMode.tsx` (expor estado)
- `src/components/LazyErrorBoundary.tsx` (fallback chunk error)
- `package.json` (scripts typecheck/check)

**Não tocar:**
- `public/sw.js` (já é kill-switch correto)
- `src/components/InstallPWA.tsx` (deixa o arquivo mas não monta)
- Qualquer arquivo de study/cards/economy lógica

## Como testar

1. **Boot frio**: limpar storage → abrir `/` → deve ir para `/auth` sem flicker.
2. **Boot logado**: estar logado → recarregar → splash → home, sem reload extra.
3. **Atualização de build**: simular mudando `BUILD_ID` → cleanup roda uma vez, sem reload automático em loop.
4. **Mobile / atalho antigo**: abrir PWA instalado antigo → kill-switch SW desregistra na próxima visita.
5. **Safe Mode**: setar `localStorage.ape_safe_mode='1'` → recarregar → sem heartbeat, sem swipe, sem prefetch. Banner com botão de sair.
6. **Network offline**: provocar fetch fail → console warn, **não** salvar como crash, banner não aparece.
7. **Chunk fail**: simular import lazy quebrado → fallback amigável via LazyErrorBoundary.
8. **Study**: abrir `/study/...` → swipe global desativado, gestos internos funcionam.
9. **Build**: `npm run typecheck` e `npm run build` passam sem novos erros.

## Riscos restantes

- Usuários com **PWA instalado antigo** (tela inicial) verão o kill-switch worker rodar uma vez antes de pegar a versão nova — pode parecer um reload extra no primeiro acesso pós-deploy. Aceitável.
- `useAuthUser` não foi mostrado; se ele tiver lógica própria de race, a correção em `SessionWatcher` pode não cobrir 100%. Vou ler antes de editar.
- Desabilitar heartbeat em safe mode pode atrasar contagem de atividade do dia se o usuário ficar preso em safe mode — mitigado pelo botão "Sair do modo seguro".
- `featureFlags` overrides afetam telas que checam flags em runtime; se alguma feature for assumida como sempre-ligada, pode mudar comportamento. Mitigação: só forço overrides quando safe mode está ativo.
- Não toco no banco, RLS, ou lógica de estudo — risco zero nessas áreas.