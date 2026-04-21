---
name: Study Flow Structural Hardening
description: Swap chunked, favorites auto-fallback, "any" direction stable per card via hashToBool
type: feature
---
Hardening estrutural do fluxo de estudo (3 correções estruturais separadas):

1. **Inverter conteúdo dos cards (ListDetail.handleSwapSides)**:
   - É operação PURA de dados: somente `term ↔ translation`. Nunca toca em ordem, IDs, favoritos, progresso, labels, idiomas ou direção.
   - Implementado em chunks de 25 (paralelo dentro do chunk, sequencial entre chunks) para não saturar pool de conexões e travar UI.
   - Guard contra concorrência (`if (isSwapping) return`).
   - Após sucesso: invalida `["flashcards", id]`, `["gameshub-list", id]`, `["study-flashcards", id]` e remove cópia offline para evitar dados desatualizados nos modos.

2. **Favoritos sem persistência invisível**:
   - GamesHub: `useEffect` auto-reseta `prefs.favoritesOnly` para false quando `favoritesCount === 0`. Switch fica `disabled`. URL nunca recebe `favorites=true` quando count é 0.
   - Study: `effectiveFlashcards` faz fallback para todos os cards quando filtro está ativo mas lista tem 0 favoritos. Toast informa "Nenhum favorito encontrado. Exibindo todos os cards." e `updatePrefs({favoritesOnly:false})` limpa o estado herdado.
   - Estado vazio final tem botão "Estudar todos os cards" (recovery path).

3. **Direção `any` estável por card**:
   - `Study.decideDirection` agora usa `hashToBool(cardId)` (de gameCore) em vez de `idx % 2`. Garante que o mesmo card sempre apareça do mesmo lado em modo "any", mesmo quando a ordem da sessão é re-embaralhada. Antes parecia "aleatório/quebrado" para o usuário.
   - Modos `a-b` e `b-a` continuam diretos (sempre o lado escolhido).

Arquitetura preservada:
- "Inverter conteúdo dos cards" = edição persistente da LISTA (dados).
- "Direção do estudo" = apresentação temporária da SESSÃO (não muta dados).
Essas duas operações nunca se misturam.
