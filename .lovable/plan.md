# Diagnóstico

Confirmado o que o pedido descreve:

1. **`prepareLayeredStudyDeck`** (`src/lib/studyDeck.ts`) usa a **primeira camada** como `entryPoint`, então o motor (`useStudyEngine`) trabalha com `playableEntryId = layers[0].id`, enquanto Favoritos/Lista Vermelha guardam o `parent_card_id`. `injectRedListRepetitions` compara `redListIds` direto contra `cardsOrder` — grupos em camadas marcados como vermelhos **não recebem repetição/prioridade**.
2. **`Study.tsx`** monta `compatibilityIds` (principal + 1ª camada + camada visível + demais) e chama `toggleFavorite.mutate(...)` / `toggleRedList.mutate(...)` num `forEach`. Isso causa N mutations paralelas → race, flicker, múltiplos toasts, snapshots concorrentes.
3. **`useRedList.removeFromRedListIfNeeded`** deleta apenas o ID passado (não cobre IDs antigos por camada) e silencia erros sem checar `error.code`.
4. **`useFavorites.useToggleFavorite`** faz `setQueriesData` em *todos* os escopos (qualquer `listId`) com prefixo `['favorites', user.id, type]` — pode mexer no estado de listas que nem contêm o card.
5. **Especiais** já estão por camada no banco, mas a UI atual também tenta tratá-los via `compatibilityIds`, podendo marcar a primeira camada como "especial" indevidamente.

# O que será feito

## 1. Resolvedor central de identidade
Criar `src/features/cards/lib/cardStatusIdentity.ts` com:
```ts
resolveCardStatusIdentity({ displayedCard, engineCard, layers }) => {
  visibleLayerId, canonicalGroupId, playableEntryId, legacyIds
}
```
Regras conforme pedido (canonical = `parent_card_id` em layered, próprio ID em normal; playable = `layers[0].id`; legacy = união de IDs antigos para limpeza/migration).

## 2. `Study.tsx`
- Substituir todo o cálculo `currentStatusTargets`/`compatibilityIds` por `resolveCardStatusIdentity(...)`.
- `favoriteTargetId = redListTargetId = canonicalGroupId`; `specialTargetId = visibleLayerId`.
- `isFavorite` / `isRedListed`: preferem `canonicalGroupId`, mas também reconhecem `legacyIds` (período de migração).
- `isSpecial`: só `visibleLayerId`.
- Handlers passam a chamar **uma única** mutation por ação (ver §3).
- Em "Modo Favoritos", desfavoritar **não remove o card atual no meio do clique** — finaliza a animação/toast, e só avança quando o usuário navegar (filtro reativo passa a aplicar no próximo `goNext`).

## 3. Mutations atômicas (sem `forEach`)
Criar em `src/hooks/`:
- `useSetFavoriteGroup()` — `{ canonicalId, cleanupIds, enabled }`.
  - **enable=false**: 1 `DELETE ... in('resource_id', cleanupIds)` em `user_favorites` (type='flashcard') **+** 1 `DELETE ... in('flashcard_id', cleanupIds)` em `user_red_list`. Sequência simples (sem RPC nova; mantém compatibilidade com banco atual).
  - **enable=true**: 1 `DELETE in(cleanupIds \ canonicalId)` para limpar marcações legadas por camada; `INSERT` apenas do `canonicalId` (tolera 23505).
- `useSetRedListGroup()` — análogo em `user_red_list`. Antes de habilitar, verifica se `canonicalId` está nos favoritos; senão bloqueia com toast claro.
- `useSetSpecialLayer()` — opera só com `visibleLayerId` em `user_special_flashcards`.

`useToggleFavorite`/`useToggleRedList`/`useToggleSpecialFlashcard` atuais ficam preservados (usados por `ListDetail.tsx`, `SpecialCards.tsx`, `ImportExplanationsDialog.tsx`), apenas o `Study.tsx` migra. O `removeFromRedListIfNeeded` passa a aceitar `string | string[]` e usar `.in(...)`.

## 4. Invariante Favorito × Lista Vermelha
- `useSetFavoriteGroup({enabled:false})` sempre limpa Lista Vermelha do grupo na mesma operação (duas chamadas, mas atômicas do ponto de vista do usuário; rollback em caso de erro).
- `useSetRedListGroup` rejeita ativação sem favorito.

## 5. Motor da Lista Vermelha
Em `useStudyEngine.ts`:
- Construir `canonicalToPlayableMap: Map<canonicalId, playableEntryId>` a partir de `flashcards` (camada agrupada via `prepareLayeredStudyDeck`). Para cards normais, `canonical === playable`.
- Antes de chamar `injectRedListRepetitions` e `orderByIntelligence`, mapear `redListIds → effectiveRedPlayableIds` usando o mapa. Banco continua guardando o canonical.
- Aplicar o mesmo mapeamento em qualquer outro ponto que compare `redListIds` com `cardsOrder` (Foco Vermelho / priorização).

## 6. Migração SQL (idempotente)
Nova migration `supabase/migrations/<ts>_canonicalize_favorites_redlist.sql`:
- Para cada `user_favorites` com `resource_type='flashcard'` cujo `resource_id` aponte para flashcard com `parent_card_id IS NOT NULL`:
  - `INSERT ... (user_id, 'flashcard', parent_card_id) ON CONFLICT DO NOTHING`;
  - `DELETE` do registro original da camada.
- Mesma lógica para `user_red_list` (usar `flashcard_id` → `parent_card_id`).
- **Não tocar** em `user_special_flashcards`.
- Tudo num único migration com CTEs/`WITH`, idempotente (rodável várias vezes).

## 7. React Query
- Nas novas mutations: `setQueriesData` apenas em chaves que contenham o `listId` do escopo atual (verificar via `queryKey[3] === listId` ou refazer fetch). Demais escopos são apenas invalidados em `onSettled` (sem mutação otimista cruzada).
- Snapshot único por mutation → rollback consistente.

## 8. Estado pendente
- Novas mutations expõem `isPending` por **grupo** (`canonicalId`) e por **camada** (`visibleLayerId`). `Study.tsx` desabilita os botões correspondentes e ignora clique duplo. `toast` único por ação (já garantido por mutation única).

## 9. Modo somente Favoritos
- Em `Study.tsx`, ao desfavoritar o card atual, **não** recomputar `cardsOrder` imediatamente. Marcar `pendingFavoritesRefilter=true` e aplicar o filtro só no próximo `goNext` ou ao concluir a sessão. Evita salto/tela vazia.

## 10. Testes
Adicionar:
- `src/features/cards/lib/cardStatusIdentity.test.ts` — 6 casos (normal, layered 1ª/2ª/3ª camada, sem layers, legacy mistura).
- `src/features/study/lib/redListMapping.test.ts` — mapeamento canonical→playable em `injectRedListRepetitions`.
- `src/hooks/__tests__/setFavoriteGroup.test.ts` (mock supabase) — enable/disable, cleanup de legacy, propagação para red list.
- Smoke test de "modo favoritos não pula card" via teste unitário do reducer/derived state.

Rodar com `bunx vitest run`.

# Arquivos a criar/editar

**Criar**
- `src/features/cards/lib/cardStatusIdentity.ts` + `.test.ts`
- `src/hooks/useSetFavoriteGroup.ts`
- `src/hooks/useSetRedListGroup.ts`
- `src/hooks/useSetSpecialLayer.ts`
- `src/features/study/lib/redListMapping.ts` (+ teste)
- `supabase/migrations/<ts>_canonicalize_favorites_redlist.sql`

**Editar**
- `src/pages/Study.tsx` (substituir bloco `currentStatusTargets` + handlers + modo favoritos)
- `src/features/study/hooks/useStudyEngine.ts` (canonical→playable map antes de `injectRedListRepetitions`/`orderByIntelligence`)
- `src/hooks/useRedList.ts` (`removeFromRedListIfNeeded` aceita array, usa `.in(...)`)
- (sem alterações em `ListDetail.tsx`, `SpecialCards.tsx`, `ImportExplanationsDialog.tsx`, `FavoriteButton.tsx`, `RedListButton.tsx`, `StudyToolsMenu.tsx`, `studyDeck.ts`)

# Restrições respeitadas
- Sistema de camadas **não** muda.
- Especiais permanecem **por camada**.
- Aparência geral preservada (apenas comportamento dos botões/handlers).
- Mudanças incrementais; hooks antigos seguem em uso fora de `Study.tsx`.

# Riscos restantes
- A operação `disable favorite` faz dois `DELETE`s (favoritos + red list) sem RPC transacional; em falha do 2º, o 1º já efetivou. Mitigado com `onSettled` invalidando ambos. Se necessário, posso adicionar uma RPC `unset_favorite_group(canonical_id, cleanup_ids[])` em iteração futura.
- Migration assume que `parent_card_id` aponta sempre para um flashcard existente; registros órfãos são mantidos como estão (não migram, não quebram).
- Mapa canonical→playable é recalculado a cada mudança de `flashcards`; em listas muito grandes (>2k cards) custa O(n), aceitável.
- Componentes fora do Study (`ListDetail`) ainda chamam `useToggleFavorite` por ID exibido — em listas isso normalmente já é o canonical/principal, então segue correto; pode ser unificado depois.
