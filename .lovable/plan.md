## Plano de correção: Favoritos, Lista Vermelha, Especiais e Importação

Escopo: eliminar divergências entre UI, cache e banco em cards com camadas, e tornar a importação de explicações realmente transacional. Sem mexer em layout geral, sem alterar o significado dos Especiais, sem permitir que estudantes editem cards alheios.

### 1. Banco de dados (migrations)

Criar 3 RPCs `SECURITY DEFINER` com `search_path = public`, validando `auth.uid()`:

- `set_flashcard_group_favorite(p_canonical_id uuid, p_cleanup_ids uuid[], p_enabled boolean)`
  - `enable=true`: DELETE legados em `user_favorites` (resource_type='flashcard', resource_id IN cleanup_ids \ canonical) → INSERT canonical (ON CONFLICT DO NOTHING).
  - `enable=false`: DELETE em `user_favorites` IN cleanup_ids + DELETE em `user_red_list` IN cleanup_ids (invariante Fav×Red).
  - Tudo em uma transação. Retorna `{ success, enabled }`.

- `set_flashcard_group_red_list(p_canonical_id uuid, p_cleanup_ids uuid[], p_enabled boolean)`
  - `enable=true`: exige existir favorito de algum id do grupo; se favorito está legado, normaliza para canonical; limpa vermelhos legados; INSERT canonical.
  - `enable=false`: DELETE vermelhos IN cleanup_ids.

- `apply_special_flashcard_explanations(p_items jsonb, p_conflict_mode text)`
  - Para cada item: valida flashcard, checa permissão de edição (owner do flashcard OU dono da turma do `list.class_id`), UPDATE retornando `ROW_COUNT`. Apenas se `ROW_COUNT = 1` → DELETE de `user_special_flashcards` para `(user_id=auth.uid(), flashcard_id=item.id)`. Caso contrário, mantém na fila.
  - Retorna `{ success, results: [{flashcard_id, status}], applied_count, kept_in_specials_count }` com status `applied|permission_denied|not_found|invalid|error`.
  - Toda a operação em uma transação por chamada; itens com `permission_denied` retornam status sem abortar a transação dos outros (loop interno com SAVEPOINT por item ou try/catch por item).

Nenhuma alteração de RLS em `flashcards`. Sem alterar shape das tabelas.

### 2. Hooks (substituir o "atomic-ish")

- `useSetFavoriteGroup`, `useSetRedListGroup`: trocar implementação interna por chamada às novas RPCs. Adicionar `onMutate` otimista (atualizar `['favorites', ...]` e `['red-list', ...]` no escopo) e rollback em `onError`. Manter assinaturas atuais.
- `useSetSpecialLayer`: adicionar `onMutate` otimista em `['special-flashcards']` e `['special-flashcards-count']`.
- Novo hook composto `useCardStatuses({ userId, listId, canonicalGroupId, visibleLayerId, cleanupIds })` que retorna `{ isFavorite, isRedListed, isSpecial, favoritePending, redListPending, specialPending, setFavorite, setRedList, setSpecial }`. Usado por Study.
- `cardStatusKeys` helper em `src/features/cards/lib/cardStatusKeys.ts`.

### 3. GamesHub — fonte única de verdade

- Substituir `useFavoritesCount(..., 'flashcard', scope)` por `useFavorites(userId, 'flashcard', scope)` e usar `data.length`.
- Não desligar `favoritesOnly` enquanto `isLoading || isFetching || isPlaceholderData || qualquer mutation pendente`. Só quando `isSuccess && !isFetching && !isPlaceholderData && data.length === 0`.
- Texto "Atualizando favoritos..." durante refetch.

### 4. StudyToolsMenu

- Sempre renderiza as 3 ações na ordem Favorito → Lista Vermelha → Especial.
- Lista Vermelha visível mas `disabled` quando `!isFavorite`, com label "Lista Vermelha — favorite primeiro" e tooltip.
- Spinner inline por ação pendente, desabilita só a ação correspondente.
- Item extra "Ver explicação detalhada" (com ícone Sparkles) quando a camada visível tiver `detailed_explanation`, abrindo `DetailedExplanationPanel` da camada atual.

### 5. SpecialCards

- Query da fila com `refetchOnMount: 'always'`, `staleTime: 0`.
- Empty state só quando `isSuccess && !isFetching && data.length === 0`. Caso contrário "Sincronizando Especiais...".

### 6. ImportExplanationsDialog

- Remover loop client-side de UPDATE por card e o DELETE separado da fila.
- Chamar `apply_special_flashcard_explanations` uma vez com todos os itens.
- Mostrar relatório por status, com cópia/baixar lista de não aplicados, sem auto-fechar se houver falhas.
- Invalidate exato: `['flashcards', listId]`, `['special-flashcards', userId]`, contagens.

### 7. Study.tsx — visibilidade imediata da explicação

Correção mínima (não migrar todo o Study para React Query agora):

- Função `applyImportedExplanationToLocalDeck(updatedCards)` que faz deep merge dos campos de explicação no deck local e em `__layers`, sem tocar em `cardsOrder`, `currentIndex`, resultados ou progresso.
- `BroadcastChannel('flashcard-explanations')` enviado pelo dialog após sucesso; Study escuta e aplica o merge.
- Limpar imports não usados (`useToggleFavorite`/`useToggleRedList`/`useToggleSpecialFlashcard` se não forem mais referenciados) — verificação file-by-file antes de remover.

### 8. Testes

Adicionar testes Vitest novos (sem reescrever existentes):

- `cardStatusIdentity` cobertura de grupo canonical.
- Optimistic update e rollback dos 3 hooks (mock supabase).
- GamesHub: não desliga favoritesOnly em placeholder/fetching.
- StudyToolsMenu: 3 ações sempre presentes, Lista Vermelha desabilitada sem favorito.
- Import: card sem permissão fica na fila; card aplicado sai.

Rodar `npx vitest run` e reportar resultado real. Build/typecheck rodam automaticamente pela plataforma.

### Arquivos

Novos:
- `supabase/migrations/<ts>_card_status_rpcs.sql`
- `src/features/cards/lib/cardStatusKeys.ts`
- `src/hooks/useCardStatuses.ts`
- Testes correspondentes em `__tests__/`.

Editados (cirurgicamente):
- `src/hooks/useSetFavoriteGroup.ts`, `useSetRedListGroup.ts`, `useSetSpecialLayer.ts`
- `src/pages/Study.tsx`, `src/pages/GamesHub.tsx`, `src/pages/SpecialCards.tsx`
- `src/features/study/components/StudyToolsMenu.tsx`
- `src/components/ImportExplanationsDialog.tsx`

Não tocados: layout geral, RLS de `flashcards`, semântica dos Especiais, schema das tabelas.

### Riscos / pontos de atenção

- A RPC de importação precisa de SAVEPOINT por item para que um `permission_denied` não derrube os demais. Vou usar bloco `BEGIN ... EXCEPTION` por item dentro do loop PL/pgSQL.
- BroadcastChannel não funciona em Safari < 15.4 e SSR; fallback via `window` event.
- Optimistic updates exigem snapshot fiel das query keys com escopo `listId` — usarei `queryClient.getQueriesData` com matcher.

Aprova para eu executar?
