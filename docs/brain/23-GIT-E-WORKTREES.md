---
cssclasses:
  - ape-ai-note
type: protocol
status: active
area: repository-operations
last_reviewed: 2026-09-12
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[10-CONTEXT-FEEDING-RULE]]"
  - "[[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]]"
---

# Git, checkouts e worktrees do App Piteco

## Regra operacional permanente

1. **GitHub/`main` é a fonte principal do código.** A verdade é o repositório
   remoto; qualquer pasta local é cópia de trabalho.
2. **`C:\Users\pedro\Documents\APP PITECO` é o checkout local principal** e
   deve permanecer na branch `main`, limpo e atualizado.
3. **Worktrees temporários ficam em
   `C:\Users\pedro\Documents\App-Piteco-Worktrees\`** — nunca espalhados
   em pastas de sistema.
4. **`AppData\Local\Temp` nunca é localização permanente.** Pode ser limpo
   pelo Windows a qualquer momento.
5. **Antes de remover qualquer worktree**, auditar: mudanças não commitadas,
   commits locais que não existem em nenhum remote, arquivos não rastreados e
   se a branch já está incorporada à `main`. Preservar antes de apagar.

## Por que essa regra existe

O projeto acumulou 47 worktrees. Muitos foram esvaziados por limpadores de
disco, o que fazia o Git reportar centenas de deleções e criava a impressão de
trabalho perdido. O checkout principal ficou parado numa branch antiga, de modo
que abrir a pasta "principal" mostrava código desatualizado.

## Limpeza executada — 2026-09-12

- [VERIFIED-GIT] 47 worktrees auditados; **45 removidos**; 2 mantidos.
- [VERIFIED-GIT] 33 estavam **vazios** (arquivos removidos do disco) e 12
  intactos, porém sem trabalho exclusivo.
- [VERIFIED-GIT] Apenas um worktree tinha commits inexistentes em qualquer
  remote: `fix/reinforcement-layout-20260912` (2 commits). A branch foi enviada
  ao GitHub antes da remoção.
- [VERIFIED-GIT] Trabalho real não commitado encontrado e preservado no
  worktree `piteco-contextual` (18 arquivos-fonte + 2 não rastreados). Ele foi
  movido para `App-Piteco-Worktrees\piteco-contextual`.
- [VERIFIED-GIT] Os relatórios da auditoria visual (`docs/agent-orchestration`),
  o patch de `supabase/functions/mcp/index.ts` e os não rastreados do checkout
  principal foram copiados para
  `App-Piteco-Worktrees\_preservado\20260912\`.
- [VERIFIED-GIT] Checkout principal passou para a branch `main` em `0a06864a`,
  limpo; as alterações antigas ficaram em `git stash` (`preservado-pre-cleanup-20260912`).
- [VERIFIED-GIT] `AppData\Local\Temp` ficou sem nenhuma pasta `ape-*`.

## Regra de retomada

Para trabalhar em uma tarefa isolada: criar o worktree dentro de
`App-Piteco-Worktrees`, trabalhar, validar, integrar à `main` e então remover o
worktree — sempre auditando antes. Não usar `Temp`.

Related: [[01-CURRENT-STATE]] · [[10-CONTEXT-FEEDING-RULE]] · [[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]]
