---
name: Scope-Isolated Study Sessions
description: All vs Favorites vs RedFocus persist as separate study_sessions rows, switching never resets index
type: feature
---
Persistência por escopo das sessões de estudo (study_sessions):

**Problema corrigido**: alternar entre "todos os cards" e "jogar favoritos" zerava o currentIndex porque ambos os escopos compartilhavam a mesma sessão aberta, e handleSettingsChange chamava restartSession() (que faz setCurrentIndex(0)).

**Solução**:
1. `useStudyEngine` calcula `sessionScopeKey = "${subset}:${orderMode}:${redFocus?'red':'normal'}"` e o inclui no `initKey` + nos deps do effect de inicialização. Trocar de escopo dispara reinit (não reset).
2. `initializeSession` busca até 10 sessões abertas mais recentes de `(user_id, list_id, mode)` e seleciona aquela cujo `cards_order` (set único de IDs) coincide com o deck efetivo atual. Se nenhuma combinar, cria nova. Sessões antigas de outros escopos NÃO são marcadas como `completed` (preservam progresso do outro trail).
3. `flipProgressKey` no localStorage agora inclui userId + mode + sessionScopeKey: `flip-progress-${uid}-${listId}-${mode}-${scope}`.
4. `handleSettingsChange` em Study.tsx NÃO chama mais `restartSession` ao detectar `subsetChanged` ou `redFocusChanged`. Em vez disso, chama `saveProgressNow()` (gravação imediata sem debounce) antes de mudar `gameSettings`. O engine reinicializa naturalmente via dependência de `sessionScopeKey` e carrega a sessão do novo escopo.
5. `restartSession` permanece, mas só é usado em ações explícitas do usuário ("Reiniciar Jogo", "Jogar novamente").

**Garantias**:
- Modo normal (300 cards, índice 150) → ativar favoritos → favoritos abre no índice salvo do escopo favoritos (ou 0 se primeira vez).
- Voltar para normal → restaura índice 150.
- `safeIndex = min(max(saved, 0), order.length - 1)` lida com favoritos adicionados/removidos sem resetar.
- Não houve migration de schema — match de escopo é feito por igualdade de set de IDs em `cards_order`.
