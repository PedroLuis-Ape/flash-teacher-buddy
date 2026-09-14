---
cssclasses:
  - ape-ai-note
type: session-checkpoint
status: active
date: 2026-09-14
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[08-RISKS]]"
  - "[[23-GIT-E-WORKTREES]]"
  - "[[areas/mcp-reference-ids-and-importers]]"
---

# Auditoria de continuidade — 2026-09-14

## Objetivo

Comparar o estado PRETENDIDO do App Piteco com o estado REAL do GitHub e consolidar no `main` tudo que pertencia ao escopo atual, sem merge cego e sem deploy/publicação/migration remota.

## Números do main

- `MAIN BEFORE`: `b1f98177`
- `MAIN FINAL`: `f998913c`
- Consolidado nesta auditoria: PR #403 (`6cca86f6`) e PR #404 (`f998913c`).

## O que foi recuperado (estava pronto, mas fora do main)

- [FATO CONFIRMADO] Documentação operacional que existia só como alteração NÃO COMMITADA no checkout `C:\\Users\\pedro\\Documents\\APP PITECO`: seção do time CLARA no `AGENTS.md`, decisões de CLARA/CCL/contexto adaptativo em [[04-DECISIONS]] e [[05-AGENTS]], [[25-CCL-REGISTRY]], `docs/brain/registry/ccl-registry.json` e `FLASHCARD_AGENT.md`.
- [FATO CONFIRMADO] Lição `2026-09-12-browser-first-tts` (`VALIDATED_LESSON`), que só existia na branch `codex/extension-ai-export-brain-20260912`, ligada em [[learning/LESSON-INDEX]].
- [CONFLITO RESOLVIDO] A documentação local fixava as Claras em DeepSeek `deepseek/deepseek-v4-flash` com esforço `ultra`. A decisão vigente é `gpt-5.6-luna` + `high`, sem `xhigh`/`ultra` e sem escalonamento automático; a decisão antiga ficou marcada como SUBSTITUÍDA, não apagada.

## PRs abertas: 23 → 0

- [FATO CONFIRMADO] **0 PRs abertas** ao fim da auditoria. Todas fechadas com comentário de evidência registrando o motivo e mantendo a branch no Git.
- [FATO CONFIRMADO] Já entregue no main (fechadas como entregues): #243 (patch equivalente), #357 (`features/library/viewPreferences`), #306 (runtime Supabase `ymahldldyxvwjeruaxpr`), #222 (consolidação em listas existentes), #212 (parser resiliente em `features/smart-import/`).
- [FATO CONFIRMADO] Substituídas/obsoletas (fechadas): #385 (375 commits atrás; comportamento já no main pela harmonização de setembro), #371 (409), #360/#359/#358 (série Piteco Play, 426 atrás), #356 (426), #355 (426), #318 (625), #278 (728), #246 (801), #192 (1000), #155 e #107 (junho, mais de mil commits atrás).
- [FATO CONFIRMADO] Atualizações de dependência fechadas por não serem mergeáveis sem migração validada: #271 (`vite` 6.4.3 → 8.3.0 e `vitest` 4.1.9 → 5.0.0), #172 (`sonner` 1 → 2), #171 (`react-router-dom` 6 → 7), #174 e #173 (patches com lockfile defasado).

## Trabalho não commitado que NÃO foi mergeado

- [FATO CONFIRMADO] Worktree `piteco-contextual` (branch `fix/contextual-glossary-20260910`, 168 commits atrás) tem 18 arquivos de glossário/expressões/smart-import NÃO COMMITADOS. É uma iteração ANTIGA: o WIP remove `expression`, `segments` e `occurrence` do contrato de `MergedHint`, que o main mantém hoje, e o main já tem `glossaryExpressions`. Worktree preservado, sem merge.
- [FATO CONFIRMADO] A alteração local em `src/features/study/lib/listMarkers.ts` do worktree `folder-grid-view-20260914` é só diferença de fim de linha; não é trabalho.

## Regra operacional confirmada de novo

- [FATO CONFIRMADO] `build` antes de `mcp:bundle`: o `vite build` reescreve `supabase/functions/mcp/index.ts` com caminho absoluto do Windows e só a regeneração posterior deixa o bundle válido. Ver [[areas/mcp-reference-ids-and-importers]].

Related: [[00-HOME]] · [[01-CURRENT-STATE]] · [[08-RISKS]] · [[23-GIT-E-WORKTREES]]
