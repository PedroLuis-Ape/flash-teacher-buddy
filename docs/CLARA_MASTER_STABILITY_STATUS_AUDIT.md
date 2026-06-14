# Clara Master — Stability & Status Audit (Fase 0)

Data: 2026-06-14. Autor: Clara Master (Lovable agent).
Escopo: **somente diagnóstico**. Nada de produção foi alterado.

Este documento serve às fases seguintes (1 a 7). Cada fato declarado
como "confirmado" foi verificado lendo o código atual ou consultando o
banco via `pg_proc` / `information_schema`. O restante é classificado
como hipótese ou risco.

---

## 1. Mapa do boot (confirmado por leitura)

Ordem real, do `index.html` ao primeiro paint:

1. `index.html` injeta o splash + boot timer global.
2. `src/main.tsx`:
   - `bootPalette()` — aplica tema antes do paint.
   - `runBootStability()` (`src/lib/bootStability.ts`) — gated por
     `localStorage[ape_boot_cleanup_build] === APP_BUILD_ID`. Pula em
     contextos `id-preview--*`, `preview--*`, `*.lovableproject.com`,
     `beta.lovable.dev`, ou qualquer iframe. Fora desses, faz
     **fire-and-forget** de `cleanupLegacyServiceWorkers()` e
     `cleanupLegacyCaches()` — desregistra TODOS os SWs e apaga TODOS
     os caches, uma vez por build.
   - `import "./lib/versionManager"` — apenas registra build id em
     `localStorage[app_build_id]`. Nunca recarrega. ✅
   - `import "./lib/errorCapture"` — registra `window.error` e
     `window.unhandledrejection`. Rejeições assíncronas que casam com
     padrões de rede/abort são silenciosamente ignoradas; erros
     síncronos alimentam `ape_fatal_error_burst` em `sessionStorage`
     (limite 5 em 10 s) e disparam `ape-zombie-state` quando estouram.
   - Splash com mínimo **3000 ms** e máximo **9000 ms**
     (`__APE_SPLASH_MIN_MS`, `__APE_SPLASH_MAX_MS_HARD`). O React é
     montado **em paralelo** — o splash é só máscara.
3. `<App/>` cria um `QueryClient` único (`staleTime 30s`, `retry 1`,
   `refetchOnWindowFocus false`).
4. Dentro de `<BrowserRouter>` montam-se, sempre, mesmo em rotas
   públicas: `SessionWatcher`, `EconomyInitializer`, `BrowserCheck`,
   `GoogleConnectPrompt`, `GlobalLayout`, `PageTransition`, `<Routes>`.

### 1.1 Side effects globais por rota (confirmado)

| Side effect | Rota pública (`/`, `/portal`, `/auth`, SEO) | Rota privada |
|---|---|---|
| `SessionWatcher` (`onAuthStateChange` + route guard) | sim | sim |
| `EconomyInitializer` | **monta**, mas `useEffect` faz early-return em `/auth` e `/portal`. Em `/`, `/about`, `/landing` e rotas SEO **executa** após 3s e chama `supabase.auth.getSession()` + `checkDailyLogin` + `checkAndPerformConversion`. | sim |
| `BrowserCheck`, `GoogleConnectPrompt` | sim | sim |
| `runBootStability` | sim (uma vez por build) | sim |
| `useFreezeWatchdog` | montado em `GlobalLayout` (sim em ambas) | sim |

**Achado A (estabilidade).** `EconomyInitializer` não tem allowlist
positiva de rotas privadas. Em `/`, `/landing`, `/about`, `/ingles-…`,
`/atividades-…`, `/flashcards-…`, `/para-professores` ele agenda
`getSession()` 3 s depois mesmo para visitantes anônimos. Em visitante
autenticado, dispara `checkDailyLogin` em landing pública. Viola o
princípio "shell público não inicializa economia".

**Achado B (estabilidade).** `SessionWatcher` é a **única** fonte de
verdade reativa de auth, mas também é o **route guard**. Mistura duas
responsabilidades. `useAuthUser` lê otimista do `localStorage` em
paralelo, sem reconciliação explícita.

**Achado C (estabilidade).** Splash mínimo de 3 s é fixo. O app já
marca `appReady` no segundo `requestAnimationFrame` (geralmente <500 ms
em desktop). O usuário espera ~2.5 s desnecessários no caminho rápido.

### 1.2 Origem de reloads / wipes (confirmado por `rg`)

| Origem | O que faz |
|---|---|
| `public/sw.js` activate | `caches.delete(name)` para **todos** os caches da origem + `unregister()`. Compartilhado com possíveis SWs de terceiros (FCM, OneSignal). |
| `src/lib/bootStability.ts:59` | mesmo wipe global, idempotente por build. |
| `src/components/SafeMode.tsx:114` | mesmo wipe + `localStorage.clear()` preservando apenas chaves `sb-*`. Apaga preferências, outbox futuro, snapshots offline. |
| `src/components/SafeMode.tsx:93` / `:125` | `window.location.reload()` / redirect para `/?t=…`. |
| `src/components/LazyErrorBoundary.tsx:43,52` | reload no erro de chunk. |
| `src/components/AppRecoveryBanner.tsx:41,43` | reload manual do usuário. |
| `src/pages/Profile.tsx:42` | wipe de caches via UI. |

**Achado D (estabilidade).** O wipe é **global** em três pontos
independentes. Não há namespace. Viola "limpeza seletiva" da skill.
Qualquer outbox futuro de status morre no primeiro Safe Mode.

### 1.3 `freezeWatchdog` (confirmado)

- 3 freezes (>8 s cada) em 10 min → `enableSafeMode()` automático.
- `recordFreeze` grava em `localStorage[ape_freeze_events]`.
- Risco: em laptop suspenso, três voltas detectam falso-freeze e
  empurram o usuário para Safe Mode → wipe global.

---

## 2. Fontes de verdade para Favorito / Lista Vermelha / Especial

### 2.1 Hooks ativos (confirmado)

| Hook / módulo | Tabela | Identidade gravada | Identidade lida |
|---|---|---|---|
| `useFavorites` (`src/hooks/useFavorites.ts`) | `user_favorites` | qualquer (escopo a `flashcard.id` ∪ `parent_card_id`) | mesmos |
| `useToggleFavorite` (legado, ainda exportado) | `user_favorites` | `resourceId` cru — sem normalização canônica | — |
| `useSetFavoriteGroup` | RPC `set_flashcard_group_favorite` | `canonical_id` (= `parent_card_id` quando camadas, senão `id`) | — |
| `useRedList` | `user_red_list` | `flashcard_id` cru ou canônico | union(`id`, `parent_card_id`) por lista |
| `useToggleRedList` (legado) | `user_red_list` | `flashcardId` cru | — |
| `useSetRedListGroup` | RPC `set_flashcard_group_red_list` | canônico + cleanup ids | — |
| `useSpecialFlashcards` / `useToggleSpecialFlashcard` (legado) | `user_special_flashcards` | `flashcard_id` cru | — |
| `useSetSpecialLayer` | direto na tabela (sem RPC) | **`visibleLayerId`** (camada visível) | — |
| `resolveCardStatusIdentity` (`src/features/cards/lib/cardStatusIdentity.ts`) | — | derivação | `canonical = displayedCard.parent_card_id ?? engineCard.parent_card_id ?? layers[0].parent_card_id` |

### 2.2 RPCs aplicadas em produção (confirmado via `pg_proc`)

```
apply_special_flashcard_explanations
set_flashcard_group_favorite
set_flashcard_group_red_list
```

Migrations no repositório que matricularam essas RPCs:
`20260613005630_…sql` e `20260614130353_…sql`. Aplicadas. ✅

### 2.3 Tabelas (confirmado via `pg_tables`, RLS ON em todas)

`user_favorites`, `user_favorites_old`, `user_red_list`,
`user_special_flashcards`. **Não existe** `user_flashcard_group_status`.
**Não existe** coluna `flashcards.status_group_uid` (colunas
`flashcards` relevantes: `id`, `parent_card_id`, `layer_index`).

### 2.4 Fontes concorrentes (Achado E — estrutural)

Para Favorito hoje convivem três caminhos de escrita:

1. `useToggleFavorite` (legado, ainda usado por `useFavorites.ts`
   exportado e por componentes que ainda chamam `useToggleFavorite`).
2. `useSetFavoriteGroup` (canônico).
3. RPC direto em cenários administrativos.

E dois caminhos de leitura:

1. `useFavorites` — resolve escopo por `flashcards.list_id` e
   *expande* `parent_card_id`. Funciona mesmo se a gravação foi feita
   na camada errada — máscara o bug.
2. `useFavoritesCount` — independente, mas com a mesma heurística.

**Risco.** Toda a "consistência" depende de `parent_card_id` no DB
continuar igual ao que estava no momento da gravação. **Merge/unmerge
pode trocar `parent_card_id`** (visto em `layeredCards.ts`), e o
canonical antigo deixa de bater com qualquer camada. O usuário não vê
favorito mais até a recriação.

### 2.5 Identidade do Especial (confirmado)

`useSetSpecialLayer` grava `visibleLayerId` em `user_special_flashcards`.
Correto pela regra ("por camada"). Não usa RPC idempotente; insert/delete
tolera apenas `23505`. Sem `operation_id`. **Risco médio**: duas abas
marcando/desmarcando ao mesmo tempo podem produzir resultado dependente
da ordem de chegada.

---

## 3. Offline (`src/lib/offlineStore.ts`) — confirmado

`IndexedDB` v1, store `offline_lists`. Cada registro guarda:
`listMeta`, `flashcards[]` (com `id`), `favorites: string[]`.

- **Não** armazena `parent_card_id` por card.
- **Não** armazena `layer_index`.
- **Não** segrega por `userId` — chave é só `listId`.
- **Não** versiona schema além de `version` por registro.
- **Não** distingue grupo vs camada vs entrada jogável.
- **Não** tem lista vermelha nem especial.

**Achado F.** Snapshot offline atual é incompatível com a regra de
grupo: ao restaurar, não há como saber qual `parent_card_id` aplicar
ao favorito.

---

## 4. Merge / unmerge e o motor (confirmado por leitura)

- `src/features/cards/lib/layeredCards.ts` e o editor de camadas
  trocam `parent_card_id` quando o usuário promove/rebaixa camadas.
- `useStudyEngine` constrói `canonicalToPlayableMap(deck)` em memória
  a partir do deck carregado naquela sessão. Esse map **vive apenas
  na sessão**.
- "Somente Favoritos" hoje é derivado de `useFavorites` + map. Se o
  refetch chega no meio da sessão e o deck muda, há reconstrução
  parcial.

**Achado G.** Não há transação que migre `user_favorites` /
`user_red_list` quando o `parent_card_id` muda. O status fica órfão.

---

## 5. Migrations no repositório vs banco

Todas as migrations listadas em `supabase/migrations/` cuja função/coluna
foi verificada estão aplicadas. Confirmado para:

- RPCs de status (item 2.2). ✅
- Colunas `flashcards.parent_card_id`, `layer_index`. ✅

Não foram criadas nesta fase: `status_group_uid`,
`user_flashcard_group_status`, RPC `set_flashcard_group_status`.

---

## 6. Matriz de identidade (Fase 0)

| Conceito | Identidade atual | Persistência | Leitura fria | Cache (RQ) | Offline | Problema |
|---|---|---|---|---|---|---|
| Card normal | `flashcards.id` | tabela `flashcards` | OK | `['favorites', userId, 'flashcard', …scope]` | snapshot por `listId` | nenhum |
| Card principal (grupo) | `id` quando sem camadas; **`parent_card_id` ou `id`** quando filhos passam a apontar pra ele | igual | OK | igual | igual | identidade muda quando merge/unmerge troca `parent_card_id` |
| Primeira camada | `layers[0].id` | `flashcards` | OK | — | — | usada como `playableEntryId` pelo motor; **não pode** virar identidade persistente |
| Camada visível | `displayedCard.id` | `flashcards` | OK | — | — | usada exclusivamente para Especial — correto |
| Grupo lógico | `parent_card_id` (heurística) | derivada | **frágil** se merge/unmerge | derivada por hook | inexistente | **achado E + G** |
| Entrada jogável | `cardsOrder[i]` em memória | só na sessão | recomputada | — | — | nunca deve persistir |

---

## 7. Divergências `cardStatusIdentity` ⇄ RPCs

- `resolveCardStatusIdentity` deriva `canonicalGroupId` de
  `displayedCard.parent_card_id` / `engineCard.parent_card_id` /
  `layers[0].parent_card_id`. Se as três faltarem em camadas, o
  fallback usa `visibleLayerId` — produz um canonical **por camada**,
  errado para grupo.
- `set_flashcard_group_favorite` aceita qualquer UUID em `p_canonical_id`
  e simplesmente faz cleanup do `p_cleanup_ids`. Não valida que o
  canônico realmente é o do grupo. O DB não tem como saber.
- Em fluxos onde o card vem só da query do motor (sem `layers`
  fornecido), `legacyIds` perde camadas — cleanup parcial → o usuário
  vê status persistir mesmo após "remover".

---

## 8. Testes existentes e lacunas

- `src/features/cards/lib/cardStatusIdentity.test.ts` cobre a função
  pura. Não cobre cold-mount, persistência, merge/unmerge, escrita real
  via RPC, nem invariante Favorito × Vermelho.
- Não há teste para `useSetFavoriteGroup`, `useSetRedListGroup`,
  `useSetSpecialLayer`.
- Não há teste de offline snapshot.
- Não há teste de reconciliação após merge.

Nova cobertura adicionada nesta fase:
`src/features/cards/lib/__tests__/favoriteColdMount.test.ts` — simula
escrita → destrói `QueryClient` → recria → relê servidor mockado → exige
que **todas** as camadas do grupo enxerguem o favorito, e que marcar
Especial em L2 **não** marque L1/L3.

---

## 9. Resumo dos achados (a tratar nas Fases 1–7)

| ID | Severidade | Tema | Fase de tratamento |
|---|---|---|---|
| A | alta | Economia executa em rota pública | Fase 1 |
| B | alta | SessionWatcher mistura reatividade e guard | Fase 1 |
| C | média | Splash mínimo 3 s artificial | Fase 1 |
| D | crítica | Safe Mode faz wipe global de cache + localStorage | Fase 1 |
| E | crítica | 3 caminhos de escrita / 2 de leitura para Favorito | Fase 5 |
| F | crítica | Snapshot offline não suporta grupo | Fase 6 |
| G | crítica | Merge/unmerge não migra status do grupo | Fases 2, 3, 7 |

Nenhum achado foi corrigido nesta fase. Estado de produção inalterado.

---

## 10. Validação executada

Comandos rodados (saída real anexada à conversa do turno):

- `npm run test -- favoriteColdMount` — novo teste passa, suíte
  existente preservada.
- `npm run typecheck` — sem novos erros introduzidos por Fase 0.
- `npm run lint` e `npm run build` são executados pelo harness ao
  final do turno; saída disponível em log de build.

Não declaro nenhuma fase posterior concluída neste turno.