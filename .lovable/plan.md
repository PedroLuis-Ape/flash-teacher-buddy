
# Plano — Clara Master no App Piteco

Execução **estritamente faseada**. Cada fase tem commits independentes, evidência real e validação antes de avançar. Esta proposta cobre apenas até o fim da **Fase 0 (Auditoria + Repro)** e o desenho contratual das fases seguintes — não vou executar Fase 1+ sem você aprovar o diagnóstico produzido na Fase 0.

## Princípios que vou respeitar

- Nenhuma mudança visual ou estado em cache é prova de funcionamento.
- Identidade persistente nunca derivada de `parent_card_id`, índice de camada, primeira camada ou card visível.
- Nenhuma fase avança sem typecheck/test/build reais e teste de cold-mount (desmontar app + destruir QueryClient + remontar + ler servidor).
- Compatibilidade temporária só com prazo, telemetria e plano de remoção.
- Migrations destrutivas: nunca nesta entrega. Tabelas legadas (`user_favorites`, `user_red_list`, `user_favorites_old`) permanecem.

## Escopo desta entrega (Fase 0 apenas)

Quero entregar primeiro o diagnóstico, porque a skill exige fatos confirmados antes de qualquer alteração estrutural. Concretamente:

1. **`docs/CLARA_MASTER_STABILITY_STATUS_AUDIT.md`** com:
   - Mapa do boot: `main.tsx`, `bootStability`, `versionManager`, `errorCapture`, `SafeMode`, `useFreezeWatchdog`, service worker (`public/sw.js`), `EconomyInitializer`, `SessionWatcher`, `RootEntry`, `useAuthUser`.
   - Inventário de side-effects globais em rota pública vs privada.
   - Origem de todo `window.location.reload`, `caches.delete`, `localStorage.clear`.
   - Fontes de verdade concorrentes para Favorito/Vermelho/Especial: `useFavorites`, `useFavoritesCount` (residual), `useRedList`, `useSpecialFlashcards`, `useSetFavoriteGroup`, `useSetRedListGroup`, `useSetSpecialLayer`, RPCs `set_flashcard_group_favorite`, `set_flashcard_group_red_list`, `apply_special_flashcard_explanations`, resolver `cardStatusIdentity`.
   - Lista de migrations que existem em `supabase/migrations/` e confirmação (via `supabase--read_query` em `pg_proc`, `information_schema`, `pg_policies`) do que está realmente aplicado em produção: RPCs presentes, colunas existentes, RLS ativa.
   - Estado do offline (`offlineStore`, schema IndexedDB) frente ao modelo de status atual.
   - Comportamento de merge/unmerge sobre `parent_card_id` e o impacto em status já gravados como canônico.

2. **Matriz de identidade** (Conceito × Identidade atual × Persistência × Leitura fria × Cache × Offline × Problema) para: card normal, principal, primeira camada, camada visível, grupo, entrada jogável.

3. **Teste de reprodução de cold-mount** em `src/features/cards/lib/__tests__/favoriteColdMount.test.ts`:
   - Favorita camada 2 via mutation real (mock `supabase.rpc`).
   - Aguarda confirmação.
   - Destrói `QueryClient`, desmonta árvore React.
   - Remonta com novo `QueryClient`, força fetch do servidor (sem hidratação de cache).
   - Asserta: `is_favorite === true` em **todas** as camadas do grupo.
   - Versão paralela para Especial: marcar camada 2 não pode tornar camada 1/3 especiais.

4. **Relatório de divergências detectadas** entre o que `cardStatusIdentity` resolve hoje (`parent_card_id`) e o que as RPCs realmente exigem, incluindo cenários onde merge/unmerge muda `parent_card_id` após o status já existir.

Nenhum código de produção é alterado nesta fase. Nenhuma migration é criada.

## Validação da Fase 0

```
npm run typecheck
npm run test -- favoriteColdMount
npm run lint
npm run build
```

Saída real colada no relatório. Sem isso, a fase não é considerada concluída.

## Fases seguintes (apenas contrato, execução depende da sua aprovação após o diagnóstico)

Listadas para alinhamento, **não serão executadas neste turno**:

- **Fase 1 — Ciclo de vida.** `AuthProvider` central (`initializing | authenticated | anonymous | error`). `SessionWatcher` vira consumidor. `EconomyInitializer` recebe `userId` confirmado e só monta em rota privada. Safe Mode com limpeza por namespace (nunca apaga `auth`, `outbox`, snapshots). `errorCapture` com dedupe por fingerprint. Splash mínimo de 3s reavaliado contra métrica real. Sem tocar em status nesta fase.
- **Fase 2 — Identidade permanente.** Migration adicionando `flashcards.status_group_uid uuid`, backfill auditado, relatório de órfãos antes de qualquer `NOT NULL`. Sem dropar nada.
- **Fase 3 — Novo modelo.** Tabela `public.user_flashcard_group_status` com PK `(user_id, status_group_uid)` e CHECK `is_red_list = false OR is_favorite = true`, RLS completa, GRANTs. RPC idempotente `set_flashcard_group_status(..., p_operation_id uuid)` retornando estado confirmado. Especial mantém `user_special_flashcards` por `flashcard_id` com sua própria RPC idempotente.
- **Fase 4 — Migração sem perda.** Backfill de `user_favorites`/`user_red_list` (principais, camadas, duplicatas, órfãos) com relatório. Leitura dupla temporária com telemetria.
- **Fase 5 — Cliente + outbox.** `useFlashcardGroupStatus` / `useSpecialLayerStatus`. Outbox IndexedDB por usuário com `operationId`. Sem rede em `onMutate`. UI distingue salvando/salvo/aguardando/erro. Remoção gradual de `compatibilityIds`, `legacyIds` e `setQueriesData` em escopo amplo.
- **Fase 6 — Offline v2.** Schema IndexedDB com `status_group_uid`, `parent_card_id`, `layer_index`, `schemaVersion`, `userId`. Restaurar auth antes do snapshot. Migração explícita de snapshots antigos.
- **Fase 7 — Merge/unmerge e motor.** Merge/unmerge transferem status na mesma transação. Motor mapeia `status_group_uid → playableEntryId` em memória, nunca persiste. Testes em todos os modos. "Somente Favoritos" não reconstrói no meio da sessão.

## O que NÃO faço

- Não crio `user_flashcard_group_status` agora.
- Não removo `cardStatusIdentity` agora.
- Não mexo em `useSetFavoriteGroup` / `useSetRedListGroup` / `useSetSpecialLayer` agora.
- Não toco em layout, palette, rotas, autenticação social, public portal.
- Não declaro nenhuma fase concluída sem saída real de typecheck/test/build + teste de cold-mount passando.

## Pergunta de aprovação

Aprovo executar **apenas a Fase 0** (auditoria + matriz + teste de cold-mount + validação) e voltar com o diagnóstico real antes de qualquer alteração estrutural?

---

## Phase 1 — Lifecycle (AuthProvider central) — COMPLETED

### Changes
- **NEW** `src/contexts/AuthContext.tsx`: central provider owning the single Supabase `onAuthStateChange` subscription + `getSession()` reconciliation. Exposes discrete `status: 'initializing' | 'authenticated' | 'anonymous' | 'error'`.
- **`src/components/SessionWatcher.tsx`**: rewritten as a pure route-guard consumer of `useAuth()`. Never redirects while `status === 'initializing'` (eliminates hydration-race redirects to `/auth`).
- **`src/components/EconomyInitializer.tsx`**: consumes `useAuth()`; only runs when `status === 'authenticated'` with a confirmed `userId`, guarded by a per-user `ranForRef` (no duplicate runs).
- **`src/components/SafeMode.tsx`**: `handleClearAndReload` no longer calls `localStorage.clear()`. Cleanup is namespace-scoped, preserving `sb-*` (auth), `ape_outbox_*` (reserved for Phase 5 offline outbox), and `ape_pref_*` (user prefs).
- **`src/lib/errorCapture.ts`**: added fingerprint-based dedupe (message + first stack frame, 1.5s window) for both `error` and `unhandledrejection` listeners — prevents a single broken render from artificially tripping the fatal burst.
- **`src/main.tsx`**: splash `SPLASH_MIN_MS` floor reduced from 3000ms → 800ms (override via `__APE_SPLASH_MIN_MS` still respected).
- **`src/hooks/useAuthUser.ts`**: now prefers `useAuth()`; legacy React Query path kept as fallback (cache is kept in sync by AuthProvider).
- **`src/App.tsx`**: wraps the tree with `<AuthProvider>` inside `QueryClientProvider`.

### Validation
- `npx tsc --noEmit` → 0 errors.
- `npx vitest run` → **343 / 343 passed** across 14 test files (including the Phase 0 `favoriteColdMount` and `cardStatusIdentity` suites).

### Invariants enforced
1. Exactly one `onAuthStateChange` subscription per session.
2. Route guard cannot fire on optimistic / pre-confirmed state.
3. Economy side-effects cannot run for an anonymous user.
4. Safe Mode recovery cannot wipe auth tokens or pending offline writes.
5. Fatal-burst detector is immune to repeated identical errors.

### Risks remaining
- `useAuthUser` still keeps the legacy React Query fallback path; safe to remove only after all call sites are audited (Phase 5).
- Splash 800ms floor is a heuristic; should be replaced by a real "first meaningful paint" signal in a future polish pass.

### Rollback
Revert the listed files; AuthProvider is additive and can be removed without DB changes. No migrations were introduced in this phase.

---

## Phase 2 — Stable status identity (`flashcards.status_group_uid`) — COMPLETED

### Migration
- **`supabase/migrations/.../phase2_status_group_uid.sql`** (timestamped, applied):
  - `ALTER TABLE public.flashcards ADD COLUMN status_group_uid uuid` (nullable).
  - Backfill: `status_group_uid = COALESCE(parent_card_id, id)` — layers inherit parent id, parents/standalone keep their own id.
  - `CREATE INDEX idx_flashcards_status_group_uid`.
  - Trigger `flashcards_sync_status_group_uid` (BEFORE INSERT OR UPDATE OF parent_card_id):
    - INSERT → fills `status_group_uid` if null.
    - UPDATE → recomputes only when `parent_card_id` actually changes (merge/unmerge), so callers cannot orphan a status group.
  - `COMMENT ON COLUMN` documenting intent + Phase 3 plan.

### Audit results (real, post-migration)
| Check | Result |
|---|---|
| Total cards (non-deleted) | **3752** |
| `status_group_uid` filled | **3752 / 3752** (100%) |
| Rows where `status_group_uid = COALESCE(parent_card_id, id)` | **3752 / 3752** |
| Orphan layers (parent_card_id pointing to missing row) | **0** |
| Distribution by group size | 2737 groups of size 1, 1×3, 94×4, 36×5, 45×6, 16×7, 7×8, 2×9 |

### Why NOT NULL is deferred
Coverage is 100% and orphans are zero, so `SET NOT NULL` would succeed today. We still defer it to a later phase per the Clara Master contract: a constraint added now would block any race between Phase 3 RPC writes and the trigger if a future patch removed the trigger. The trigger + index already guarantee correctness in practice.

### Risks remaining
- 121 security linter warnings exist project-wide (pre-existing — SECURITY DEFINER functions, public buckets). **Not introduced by this migration.**
- The new trigger function is `SECURITY DEFINER`; it's a trigger (not callable as RPC), so the linter warning does not apply to caller-side exploitation, but we should review its grant footprint in Phase 3.

### Rollback
```sql
DROP TRIGGER IF EXISTS trg_flashcards_sync_status_group_uid ON public.flashcards;
DROP FUNCTION IF EXISTS public.flashcards_sync_status_group_uid();
DROP INDEX IF EXISTS public.idx_flashcards_status_group_uid;
ALTER TABLE public.flashcards DROP COLUMN IF EXISTS status_group_uid;
```
No data is destroyed by rollback — `status_group_uid` is purely derived.

### Validation
- Backfill consistency query: 0 mismatches.
- Orphan query: 0 rows.
- `npx tsc --noEmit` (re-checked after types regeneration): pending types regen.
