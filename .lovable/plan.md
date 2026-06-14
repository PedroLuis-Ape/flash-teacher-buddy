
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
