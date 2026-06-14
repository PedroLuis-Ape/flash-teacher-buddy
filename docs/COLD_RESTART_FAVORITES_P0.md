# Cold Restart Favorites — P0 Diagnosis

_Date: 2026-06-14 — Author: Clara Master_

## TL;DR

**Os Favoritos NÃO estão sendo perdidos no banco.** A regressão é uma
**falha de leitura combinada com auto-reset de preferência persistida**
disparada pela corrida de autenticação dentro de `Study.tsx`.

Evidência do banco (snapshot atual):

| Métrica | Valor |
|---|---|
| `user_favorites` (total) | **818** |
| `user_red_list` (total) | 29 |
| `user_flashcard_group_status` (total) | 294 |
| Favoritos órfãos (resource_id sem flashcard vivo) | 170 |
| Flashcards com `status_group_uid` NULL | **0** |
| Cards com camadas (`parent_card_id != NULL`) | 814 |

Os 170 órfãos são esperados (cards excluídos no soft-delete que não
passaram pelo cleanup de favoritos) e não explicam a sensação de
"sumiço" do usuário — os favoritos ativos estão íntegros.

## Classificação por categoria (do brief)

- **A — registro não gravado:** não confirmado. As 818 linhas em
  `user_favorites` indicam que a escrita do caminho legado funciona.
- **B — gravado no legado:** ✅ é o caso.
- **C — gravado no sistema novo:** parcial (294 grupos), porque
  `new_status_pipeline = "off"` no momento.
- **D — presente mas não encontrado pela UI:** ✅ **causa raiz**.
- **E — sessão/auth ainda não carregada:** ✅ **causa raiz amplificadora**.
- **F — snapshot offline incompleto:** secundária. `useOffline.download`
  ainda salva `version: 1` e não persiste `status_group_uid`,
  `parent_card_id`, `layer_index`. Onda 6 do plano cuida disso.

## Causa raiz (linhas exatas)

### 1. `Study.tsx` mantém uma segunda fonte de auth (local) e a resolve tarde

- `Study.tsx:127` `const [authUserId, setAuthUserId] = useState<string|undefined>();`
- `Study.tsx:167` `const [userId, setUserId] = useState<string|undefined>();`
- `Study.tsx:455-457` `const { data: { session } } = await supabase.auth.getSession();`
  → só dentro de `loadFlashcards`, **depois** do primeiro render.

Resultado: na primeira renderização `userId === undefined`, então
`useFavorites(userId, 'flashcard', scope)` está `enabled: false` e
retorna `data: []` com `isLoading: false`.

### 2. `favoritesFilterFellBack` interpreta "ainda não consultou" como "zero favoritos"

- `Study.tsx:226`
  ```ts
  const favoritesFilterFellBack =
    urlFavoritesOnly &&
    !favoritesLoading &&
    favorites.length === 0 &&
    flashcards.length > 0;
  ```

Como `favoritesLoading === false` quando a query está desabilitada por
falta de `userId`, a condição vira **true** imediatamente após o
carregamento de flashcards — antes do auth resolver.

### 3. O efeito de fallback grava a preferência no localStorage

- `Study.tsx:1008-1014`
  ```ts
  useEffect(() => {
    if (favoritesFilterFellBack) {
      toast.info("Nenhum favorito encontrado. Exibindo todos os cards.");
      updatePrefs({ favoritesOnly: false });
    }
  }, [favoritesFilterFellBack]);
  ```

`updatePrefs({ favoritesOnly: false })` → `useStudyPreferences` persiste
em `studyPreferences:<userId>` no localStorage.

No cold restart seguinte, `favoritesOnly` já está `false`. O usuário
percebe como "perdi meus favoritos / o modo somente favoritos foi
desativado".

### 4. Layered cards amplificam o sintoma

A query de favoritos no caminho legado é por `resource_id`. Em cards com
camadas, o favorito é gravado no id da camada visível (ou do principal).
A interseção com o deck é feita no client (`effectiveFlashcards`,
`Study.tsx:233-260`). Quando a leitura é vazia por causa do (1)+(2),
todo o grupo desaparece de uma vez — daí "é pior em cards com camadas".

### 5. GamesHub tem o mesmo padrão, parcialmente protegido

`GamesHub.tsx:170-184` já gateia o auto-reset com `isSuccess`,
`favoritesSyncing`, `favoritesMutating`. Mas:

- `favoritesMutating` depende de `mutationKey` começando com
  `'favorite'` / `'red'` — e os hooks legados (`useToggleFavorite`,
  `useToggleRedList`) **não definem `mutationKey`**, então
  `useIsMutating` retorna 0 mesmo durante a mutation.
- Não exige `authStatus === 'authenticated'` nem `userId` definido,
  então repete o mesmo erro durante a corrida de auth.

## Plano de correção (Onda 2 — entregue neste commit)

1. `src/lib/resolveStudyAccess.ts` — função pura `({authStatus, isPortalRoute, userId}) → "wait"|"authenticated"|"public"|"denied"` + testes.
2. `Study.tsx` — consumir `useAuth()`; remover `setUserId`/`setAuthUserId` e o `supabase.auth.getSession()` interno; gatear `loadFlashcards` por `resolveStudyAccess`; tornar `favoritesFilterFellBack` exigente (success + auth + não-fetching + não-placeholder).
3. `Study.tsx` — **remover** o efeito que persiste `favoritesOnly:false`. Substituir pelo botão "Estudar todos" já existente (`handleDisableFavoritesFilter`) + toast informativo na hora.
4. `GamesHub.tsx` — endurecer o auto-reset com `authStatus === "authenticated"` + `userId`.
5. `useFavorites` / `useRedList` — adicionar `mutationKey` aos toggles legados para que `useIsMutating` em GamesHub funcione.
6. Feature flag `new_status_pipeline` permanece **`"off"`** até o final do hotfix (já está).

## Não alterado nesta onda (deferido por design)

- Trigger `flashcards_sync_status_group_uid` (Onda 4 do plano).
- RPCs definitivas de merge/unmerge (Onda 5).
- Outbox com lease (Onda 3).
- `useOffline.download` v2 com `status_group_uid` (Onda 6).
- Migração total para `user_flashcard_group_status` (Onda 7).

Esses pontos foram inspecionados e estão documentados em `.lovable/plan.md`.
Não tocá-los nesta entrega é deliberado — Clara Master exige uma onda
por vez com evidência.

## Critério de aceitação desta onda

1. Toggle "somente favoritos" sobrevive a F5 e a fechar/abrir aba.
2. Cards com camadas favoritados continuam aparecendo após cold restart.
3. `studyPreferences:<userId>.favoritesOnly` em localStorage **não muda**
   sem clique explícito do usuário.
4. Testes em `src/lib/__tests__/resolveStudyAccess.test.ts` cobrem
   `wait`/`authenticated`/`public`/`denied`.
5. Build verde.