---
cssclasses:
  - ape-ai-note
type: session-checkpoint
status: active
date: 2026-09-14
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[03-ARCHITECTURE]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[areas/adaptive-learning]]"
---

# Persistência de progresso e Listas Combinadas — 2026-09-14

## Origem

- [FATO CONFIRMADO] Contexto trazido de uma sessão feita em OUTRA interface de IA (não no Codex). O resumo original está preservado em `docs/brain/imports/2026-09-14-resumo-atualizacoes-outra-ia.json`.
- [FATO CONFIRMADO] O relato foi **reconciliado contra a realidade**: código conferido em `origin/main` (`28ee52c1`) e estado de banco conferido no projeto de produção `ymahldldyxvwjeruaxpr`. Nada aqui é aceito só porque o resumo afirmou.

## Persistência de estudo servidor-canônica — VERIFICADO

- [FATO CONFIRMADO] Produção tem `study_sessions.schema_version` e `study_sessions.client_revision` (2/2 colunas).
- [FATO CONFIRMADO] Produção tem a tabela `study_progress_events`, com `UNIQUE(user_id, operation_id)` (idempotência por operação) e índice `(user_id, created_at DESC)`.
- [FATO CONFIRMADO] As três RPCs existem: `claim_study_session_v1`, `persist_study_session_v1`, `record_flashcard_progress_v1`.
- [FATO CONFIRMADO] ACL de `record_flashcard_progress_v1`: `postgres`, `authenticated` e `service_role` — **sem `anon`**. O REVOKE do relato vale.
- [FATO CONFIRMADO] `study_sessions` tem 189 linhas (o relato dizia 188 preservadas + as novas do dia) — não houve limpeza de dados.
- [DECISÃO VIGENTE] O servidor é a **fonte de verdade** do progresso; `localStorage` é cache/outbox (flush a cada 5 s ou 10 cards). O progresso fica anexado ao **flashcard original**, o que faz Lista Combinada e lista normal compartilharem o mesmo progresso canônico.
- [FATO CONFIRMADO] No `main`: `src/features/study/lib/studyServerPersistence.contract.test.ts`, `src/features/study/lib/studyDeckSupabaseGateway.ts` (+ testes `embedded`), e a migration `supabase/migrations/20260914215300_208b1682-63b5-4a84-9d90-20f5dc733492.sql`.

## Listas Combinadas / Embedded Lists — VERIFICADO

- [FATO CONFIRMADO] Produção tem `public.embedded_lists` e `public.embedded_list_cards`, com as 6 RPCs (`create_embedded_list`, `embed_source_lists`, `embed_cards`, `unembed_cards`, `unembed_source_list`, `clear_embedded_list`).
- [FATO CONFIRMADO] No `main`: `src/features/library/embeddedLists.ts`, `EmbeddedListDialogs.tsx`, `embeddedLists.contract.test.ts`, `embeddedListsFolderUi.contract.test.ts` e `src/features/study/lib/embeddedListStudyIntegration.contract.test.ts`.
- [DECISÃO VIGENTE] Lista combinada **não duplica flashcard**: ela referencia o card original, então estudar a combinada grava progresso no card canônico. `unembed` remove só a referência, nunca o card.
- [LIMITE] A flag `new_status_pipeline` continua `off` — é subsistema de status de grupo, separado do pipeline de persistência. Não confundir os dois.

## Correções pontuais do mesmo dia (relato corroborado)

- [FATO CONFIRMADO] “Adicionar ao Reforço” / “Remover do Reforço” aparece no código (substituiu “Difícil”).
- [RELATO] As demais correções descritas (Flip contínuo sem exigir Sabia/Não Sabia, retorno para `/dashboard` ao salvar sessão privada, layout do card de Reforço no mobile, guard anti-duplo-clique no modo Reescrita) vieram do resumo sem verificação linha a linha nesta rodada.

## Pendências reais

- [PENDENTE] Validação visual com conta real em **dois dispositivos/navegadores** (a sessão que fez as mudanças não tinha sessão autenticada).
- [PENDENTE] Criar uma **lista combinada de verdade** em produção para confirmar a experiência completa na tela.
- [PENDENTE] Migração multilíngue ampla continua fora do escopo.
- [FATO CONFIRMADO] Nada foi publicado/deployado em produção por aquela sessão; nenhum reset, drop ou troca de project ref.

Related: [[00-HOME]] · [[01-CURRENT-STATE]] · [[03-ARCHITECTURE]] · [[07-TESTS]] · [[08-RISKS]]
