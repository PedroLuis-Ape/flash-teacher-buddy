# Special Import/Export — Finalização (CLARA MASTER)

## Status desta sessão: Onda 1 entregue. Ondas 2–4 NÃO entregues.

Resposta honesta ao escopo do pedido (Web Worker, IndexedDB de retomada,
RPCs novas com tabela de idempotência, paginação server-side de Especiais,
exportação em lotes com download, suíte de carga 1.000 itens): não cabe em
um único turno com evidência real. A skill CLARA MASTER proíbe declarar
concluído sem prova, então o trabalho foi fatiado em ondas verticais.

---

## Onda 1 — entregue agora

**Causa raiz endereçada:** o diálogo `ImportExplanationsDialog` fazia
(a) um único `.in("id", [...milhares])` no validate e (b) uma única chamada
RPC `apply_special_flashcard_explanations` com TODO o payload. Ambas
geram long tasks acima de vários segundos e travam a UI. Além disso, ele
invalidava `["flashcards"]` e `["list-flashcards"]` globalmente, disparando
refetch em cascata após cada importação grande.

**Mudanças:**

- Novo utilitário `src/features/special-import/lib/chunking.ts`
  - `chunk`, `runInBatches`, `yieldToMain`
  - Lotes: validate=100, apply=50
  - Cede a thread principal entre lotes via `scheduler.yield` (com fallback)
  - AbortSignal cooperativo (cancela ENTRE lotes; nunca aborta RPC em voo)
- `ImportExplanationsDialog`:
  - Validate em lotes de 100 ids
  - Apply em lotes de 50 itens contra a **RPC existente** (sem mudar contrato)
  - Indicador de progresso “processados/total” durante validate e apply
  - Invalidação direcionada: apenas `list-flashcards`/`flashcards` das listas
    realmente afetadas pelos cards aplicados — não mais invalidação global
- Testes unitários em `chunking.test.ts` (6 casos, incluindo cancelamento)

**O que foi preservado intencionalmente:**
- Contrato da RPC `apply_special_flashcard_explanations` (idempotente por
  item; somente `status === 'applied'` remove do `user_special_flashcards`)
- Exportação atual (continua copiando para clipboard, sem remover)
- Favoritos, Lista Vermelha, status_group_uid, merge/unmerge, jogos, PWA

**Validação executada:**
- `bunx vitest run src/features/special-import` → 6/6 passing
- `bunx tsc --noEmit` → sem erros

**Limitação honesta:** o JSON.parse inicial e a normalização continuam na
thread principal. Para payloads acima de ~2 MB o parse ainda gera uma long
task. Endereçado na Onda 2 (Worker).

---

## Onda 2 — Parser Worker + entrada por arquivo (NÃO entregue)
- `specialImportParser.worker.ts` (JSON.parse, normalização, dedup, schema)
- `specialImportSchema.ts` com limites (5 MB / 5.000 itens / campos)
- Drop zone `.json` + Textarea desacoplada (uncontrolled)

## Onda 3 — RPCs idempotentes + retomada (NÃO entregue)
- Tabela `special_explanation_import_items (user_id, import_id, flashcard_id, payload_hash, status)` com unique key
- RPC `validate_special_explanation_import_batch(p_items jsonb)` (≤100)
- RPC `apply_special_flashcard_explanations_batch(p_import_id, p_items, p_conflict_mode)` (≤50, retorna `removed_from_specials` calculado a partir de `ROW_COUNT` real do DELETE)
- IndexedDB `special-explanation-import-jobs` para pausar/retomar
- Prévia paginada (50/pg) com filtros por status

## Onda 4 — Export em lotes + Especiais paginados (NÃO entregue)
- Export JSON/TXT em lotes (10/25/50), download Blob com `URL.revokeObjectURL`
- RPC `get_special_flashcards_page(p_limit, p_offset, p_search)`
- `SpecialCards.tsx` usando `useAuth` (remover `supabase.auth.getUser` local) e paginação server-side
- Listener central em `Study` para evento `flashcard-explanations` (hoje sem consumidor real)

## Rollback da Onda 1
`git revert` do commit desta sessão. As mudanças são puramente client-side
e o contrato da RPC permanece idêntico — nenhum dado migrado, nenhuma
migration aplicada.

## Riscos restantes conhecidos
1. Parse inicial bloqueante (vide Onda 2)
2. Sem retomada de importação após reload no meio do apply (vide Onda 3)
3. Tela de Especiais ainda carrega tudo de uma vez (vide Onda 4)
4. Evento `flashcard-explanations` continua sem consumidor confirmado
5. Métricas com 1.000 itens não foram coletadas nesta sessão — pendência
   honesta; o ganho da Onda 1 é estrutural (50× menos itens por RPC, sem
   invalidação global) mas não tenho número antes/depois para citar.

## Próximo passo recomendado
Confirmar prosseguimento para Onda 3 (RPCs + idempotência) — é a peça que
desbloqueia retomada real e contagem confiável de `removed_from_specials`.