## Diagnóstico inicial

Regressão P0: favoritos somem após fechar/reabrir o app, principalmente em cards com camadas. A skill CLARA MASTER exige **evidência antes de código** — não vou tocar em nada sem antes provar o que está acontecendo no banco e isolar causa raiz vs. sintoma.

A entrega é grande (14 blocos) e mistura **hotfix urgente** (blocos 1–7) com **refatorações estruturais** (blocos 8–12). Vou executar em ondas, cada onda fechada e validada antes da próxima, para respeitar a regra de "não implementar pela metade" sem virar um big-bang de 30+ arquivos numa tacada só.

---

## Onda 1 — Diagnóstico (sem código de produção)

**Objetivo:** confirmar se é perda de dado, falha de leitura, corrida de auth, ou snapshot offline.

1. Pedir ao usuário o `user_tag` (ou email) de um aluno afetado para rodar `supabase--read_query` sobre:
   - `user_favorites` (count, resource_ids recentes)
   - `user_flashcard_group_status` (count, status_group_uid, last_operation_id)
   - `user_red_list`
   - `flashcards` correspondentes (parent_card_id, status_group_uid, layer_index)
   - órfãos: favorites apontando para flashcards deletados / status_group_uid nulo
   - registros do trigger `flashcards_sync_status_group_uid` que possam ter reescrito identidades
2. Inspecionar `Study.tsx`, `useFavorites`, `useStudyPreferences`, `GamesHub`, `useOffline`, `statusOutbox`, `statusDrainer` antes de mudar qualquer linha.
3. Entregar `docs/COLD_RESTART_FAVORITES_P0.md` classificando cada favorito perdido em uma das categorias A–F do brief.

**Critério de saída:** relatório commitado, causa raiz nomeada por arquivo/linha. Sem isso, qualquer "correção" é gambiarra.

---

## Onda 2 — Hotfix de leitura (blocos 2, 3, 4, 5, 6)

Não toca em schema. Não ativa flag nova. Restaura confiabilidade do caminho legado (`user_favorites` + `user_red_list`).

1. **`src/lib/resolveStudyAccess.ts`** (novo, puro): `({authStatus, isPortalRoute, userId}) → "wait" | "authenticated" | "public" | "denied"`. Testes unitários.
2. **`src/pages/Study.tsx`**: remover `authUserId`/`userId` locais e o `supabase.auth.getSession()` dentro de `loadFlashcards`. Consumir só `useAuth()`. `loadFlashcards` reage a `resolvedId` + estado `authenticated` confirmado. Cancelar resposta antiga ao trocar rota/usuário (AbortController + ref de geração).
3. **`src/hooks/useFavorites.ts`** (e equivalente para red list): expor `favoritesState` derivado dos sinais explícitos (`isSuccess && !isFetching && !isPlaceholderData && authStatus==='authenticated' && userId && !pendingMutations && !pendingOutbox`). `data` default continua `[]` mas consumidores devem usar `favoritesState`, não `length===0`.
4. **`src/pages/Study.tsx` + `GamesHub.tsx`**: remover qualquer `useEffect` que faça `updatePrefs({favoritesOnly:false})` por causa de `favoritesFilterFellBack`. Em vez disso, renderizar empty state com botão "Estudar todos" (ação explícita).
5. **GamesHub**: adicionar `mutationKey: ["favorite-group", userId, canonicalId]`, `["red-list-group", userId, canonicalId]`, `["special-layer", userId, visibleLayerId]` nos hooks legados ativos, para o `useIsMutating` existente parar de retornar 0 falsamente.
6. **Feature flag**: confirmar `new_status_pipeline = "off"` em `src/lib/featureFlags.ts` e travar até o final do hotfix.

**Testes adicionados** (`src/features/study/__tests__/coldRestart.test.tsx`): cenários 1, 2, 3 do bloco 7 (auth atrasada, primeira leitura nula com evento posterior, query com erro). Cenários 4 e 5 (cold restart real e camadas) entram como testes de integração com mock de QueryClient remontado.

**Critério de saída:** `npm run check` verde + os 5 cenários do bloco 7 passando + smoke manual no preview confirmando que toggle "somente favoritos" sobrevive a F5 e a fechar/abrir aba.

---

## Onda 3 — Outbox com lease (bloco 10)

Sem isso, qualquer operação que feche o app durante `markInflight` fica presa, e o sintoma volta.

1. Migration: adicionar `lease_owner`, `lease_expires_at`, `attempts`, `updated_at` em `user_flashcard_group_status_outbox` (IndexedDB-only hoje — provavelmente a mudança é em `src/features/cards/lib/statusOutbox.ts`, não SQL). Reavaliar ao ler o código.
2. `listPendingForUser` passa a incluir `inflight` com `lease_expires_at < now()`.
3. `markInflight` atribui lease curto (ex.: 30s).
4. Startup: `AuthProvider` autenticado → requeue de inflight expirado + failed recuperável → `drainUser` único (mutex já existe).
5. Triggers de drain: `online`, `pageshow`, `focus` (debounced), `SIGNED_IN`, botão manual.
6. Teste: simular fechamento depois de `markInflight`, reabrir, lease expira, mesma `operationId` é reenviada, RPC idempotente confirma.

---

## Onda 4 — Identidade imutável (bloco 8)

**Migration corretiva** sem destruir registros:
- Alterar `flashcards_sync_status_group_uid` para só definir em `INSERT`. Remover a recomputação em `UPDATE` quando `parent_card_id` muda.
- Merge/unmerge passam a decidir identidade transacionalmente dentro das RPCs (bloco 11).
- Auditoria: query que lista grupos cujo `status_group_uid` foi reescrito desde a versão atual do trigger; relatório em `docs/STATUS_GROUP_UID_AUDIT.md`.

---

## Onda 5 — RPCs de merge/unmerge definitivas (bloco 11)

Criar `merge_cards_transactional(card_ids[], destination_principal_id?)` e `unmerge_group_transactional(principal_id)` que:
- preservam conteúdo,
- atribuem/preservam `status_group_uid` imutável,
- transferem favorito/red list para o novo grupo,
- preservam Especiais por `flashcard_id`,
- retornam principal + grupos afetados.

Substituir chamadas em `LayeredCardEditor`, `MergeIntoLayersDialog`. Manter as RPCs antigas como deprecated por 1 release.

---

## Onda 6 — Offline V2 real (bloco 12)

`src/hooks/useOffline.ts` (`download`) passa a selecionar `status_group_uid, parent_card_id, layer_index` e a salvar `schemaVersion:2, userId, favoriteGroupUids, redListGroupUids, specialLayerIds`. Snapshots v1 sem identidade comprovável → marcar `needsResync=true` ao ler; Study força redownload. Study restaura auth antes de escolher snapshot.

---

## Onda 7 — Migração da arquitetura-alvo (bloco 9)

Só depois de tudo acima estável. Migrar **todos** os consumidores (Study, GamesHub, ListDetail, FavoriteButton, RedListButton, filtros, contagens, motor, Foco Vermelho, exportações, admin) para `user_flashcard_group_status` + `user_special_flashcards` num único PR, com:
- leitura nova primeiro + fallback legado controlado + telemetria de divergência,
- flip de `new_status_pipeline` para `"on"` no fim,
- data definida de remoção dos fallbacks e das tabelas `user_favorites` / `user_red_list`.

---

## Verificação final (bloco 13/14)

`typecheck`, `test`, `lint`, `build`, `check`. Smoke real no preview com matriz: card normal/camadas × Favorito/Red/Especial × F5/fechar-abrir/nova aba/rede lenta/offline/fechar-durante-save/merge/unmerge. Evidência de banco antes/depois anexada ao relatório final.

Critério de aceitação = os 9 pontos do bloco 14 cumpridos com evidência, não com toast verde.

---

## O que preciso de você antes de começar

1. **Confirmação de prosseguir onda a onda** (Onda 1 primeiro, sem código). Cada onda termina com evidência e só então abro a próxima. Alternativa: você autoriza eu agrupar Ondas 1+2 numa entrega só (diagnóstico + hotfix de leitura) — é o mínimo para parar o sangramento em produção.
2. **`user_tag` ou email de 1–2 alunos afetados** para a consulta de diagnóstico da Onda 1. Sem isso, o relatório vira hipótese.
3. **Janela de risco**: as Ondas 4 e 5 (trigger + RPCs de merge) são mudanças estruturais no banco. Quer que eu execute em horário de menor uso, ou tanto faz?

Não vou começar a editar até você responder. CLARA MASTER proíbe começar enquanto a regra tiver ambiguidade material.
