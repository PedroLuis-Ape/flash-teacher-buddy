# Layered Favorites — Cold Restart P0

Date: 2026-06-14
Skill: CLARA MASTER
Scope: Favoritos / Lista Vermelha de cards com camadas.

## Sintoma
- Card normal: favorito persiste após fechar/abrir o app.
- Card com camadas: estrela aparece em sessão, **some** após cold restart.

## Causa raiz (medida no banco, não inferida)

Snapshot antes da correção (em `public.user_favorites` resource_type=flashcard):

| total | em camada (parent_card_id IS NOT NULL) | órfãos (resource_id sem flashcard) |
|-------|---------------------------------------|-------------------------------------|
| 798   | 334                                   | 170                                 |

Todos os 334 favoritos em camada eram de **um único usuário**
(`fef0d514-…`). Eles foram gravados pelo legado `useToggleFavorite`, que
escreve `resource_id = LAYER_ID`. O novo `useSetFavoriteGroup` grava
`resource_id = PRINCIPAL_ID` (via RPC `set_flashcard_group_favorite`).

- Durante a sessão, o update otimista de `useSetFavoriteGroup` adiciona o
  `PRINCIPAL_ID` no cache do React Query. `ListDetail.tsx` fazia
  `favSet.has(flashcard.id)` (= principal) e a estrela aparecia.
- Após cold restart, o servidor devolvia **`LAYER_ID`**, mas a UI só
  comparava contra o `PRINCIPAL_ID` da linha exibida. Miss → some.

Os 170 órfãos eram registros apontando para flashcards inexistentes
(provavelmente apagados por `hard delete`); ocupavam espaço e poluíam
contagens, sem efeito visível.

## Correção aplicada (sem alterar pipeline novo, sem mexer em PWA/Auth)

1. **Backfill idempotente** (`supabase/migrations/…`)
   - Para cada `(user_id, LAYER_ID)` em `user_favorites`, garante linha
     `(user_id, PRINCIPAL_ID)` (ON CONFLICT DO NOTHING) e só então remove
     a linha da camada. Resultado real:
     ```
     favorites_principal_inserted: 0    (todos já tinham canônico)
     favorites_layer_deleted:      334
     favorites_orphan_deleted:     170
     red_layer_deleted:            0
     ```
     Snapshot pós-migração: `fav_total=294`, `fav_in_layer=0`, `fav_orphan=0`.
   - Mesma estratégia aplicada à `user_red_list` (defensiva: 0 linhas).

2. **Leitura server-side por grupo** — duas RPCs novas, SECURITY DEFINER,
   `auth.uid()` interno, GRANT só para `authenticated`:
   - `get_scoped_flashcard_favorites(p_list_id, p_collection_id, p_folder_id, p_institution_id)`
   - `get_scoped_flashcard_red_list(...)`
   - Devolvem `TABLE(group_id uuid)` — sempre canônico
     (`COALESCE(parent_card_id, id)`), sem duplicar.
   - Tratam principal soft-deleted com camadas vivas (`flashcards.deleted_at IS NULL`
     considera apenas cards vivos, e o group_id é resolvido a partir de qualquer
     card vivo do grupo).

3. **Hooks** (`src/hooks/useFavorites.ts`, `src/hooks/useRedList.ts`)
   - Removida a consulta client-side que montava um array com `id +
     parent_card_id` de TODOS os flashcards da lista para um `.in(...)`.
     Em listas grandes/com camadas isso é estruturalmente frágil.
   - Caminho `flashcard + scope` passa a chamar a RPC.
   - Mesma query key (`['favorites', userId, resourceType, scope…]`) e
     mesmo tipo de retorno (`string[]`), para preservar todas as mutations
     e updates otimistas existentes (`useSetFavoriteGroup`,
     `useToggleFavorite`, `useSetRedListGroup`).

4. **UI** (`ListDetail.tsx`, `Study.tsx`)
   - `ListDetail` checa `favSet.has(resolveLegacyFlashcardGroupId(card))`
     em vez de `favSet.has(card.id)`. Card com 10 camadas mostra 1 estrela.
   - `Study` não tenta mais procurar "a camada favoritada" ao montar o
     deck — Favorito é do grupo, então `layerIdx=0` por padrão.

5. **Helper** `src/lib/resolveFlashcardGroupId.ts` — fonte única para o
   mapeamento legado `(__parentCardId || parent_card_id || id)`. Não toca
   em `status_group_uid` (pipeline novo permanece off).

## Não feito nesta entrega
- Não ativado `new_status_pipeline`.
- Não alterado o trigger `flashcards_sync_status_group_uid`.
- Não alteradas RPCs de merge/unmerge.
- Não alteradas PWA, autenticação ou transições.

## Rollback
- As RPCs novas são puramente adicionais — `DROP FUNCTION` é seguro.
- O backfill removeu linhas duplicadas e órfãs. Restaurar exigiria
  backup pontual de `user_favorites` anterior à migração; a evidência do
  estado pré-correção está registrada em `clara_favorites_backfill_report`.
- O patch de UI é puramente leitura: reverter o commit restaura o
  comportamento antigo, mas a camada de dados continua canônica.