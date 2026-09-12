---
cssclasses:
  - ape-ai-note
---

# App Piteco Brain

> Regra ativa: alimentar este vault continuamente com contexto relevante; anotações do agente usam a cor vermelha.

> **Entrada obrigatória para agentes:** [[10-CONTEXT-FEEDING-RULE|START HERE — Protocolo de contexto]]

Memória operacional do trabalho no App Piteco. Esta pasta é um índice de contexto, decisões, riscos e checkpoints; o código continua no repositório principal e no worktree isolado indicado em [[01-CURRENT-STATE]].

## Estado atual

- [[01-CURRENT-STATE]] — fotografia factual do trabalho interrompido.
- [[02-MASTER-PLAN]] — plano de polimento visual e gates.
- [[03-ARCHITECTURE]] — stack e limites técnicos.
- [[04-DECISIONS]] — decisões que não devem ser revertidas por engano.
- [[06-BUGS]] — problemas observados e ainda pendentes.
- [[07-TESTS]] — evidências de validação e lacunas.
- [[08-RISKS]] — riscos de integração e publicação.
- [[09-ASTRA-HANDOFF]] — resumo para retomada por outro agente.
- [[10-CONTEXT-FEEDING-RULE|START HERE — Protocolo de contexto]] — regra
  permanente para recuperar somente o subgrafo relevante e reconectar
  conhecimento durável.
- [[11-ARCHIVE-IMPORT-2026-09-11]] — conteúdo completo importado do ZIP.
- [[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]] — regras para manter o vault conectado.
- [[23-GIT-E-WORKTREES]] — checkout principal, pasta oficial de worktrees e regra de limpeza segura.
- [[24-SECURITY-AUDIT-2026-09-12]] — auditoria de segurança: causa-raiz das RPCs, correções e pendências.
- [[README]] — declaração do vault canônico, proveniência e fonte de verdade.
- [[learning/00-LEARNING-HUB]] — aprendizagem por tentativa, evidência e reteste.

## Áreas

- [[areas/visual-polish]]
- [[areas/adaptive-learning]]
- [[areas/supabase-runtime]] — mapa canônico de dados, runtime e preflight.
- [[areas/motion-system]] — escopo proposto de motion e microinterações.

## Navegação por contexto

- Estado e retomada: [[01-CURRENT-STATE]] → [[12-PROCESS-LOG-2026-09-11]]
- Qualidade e evidências: [[07-TESTS]] → [[08-RISKS]]
- Decisões e problemas: [[04-DECISIONS]] → [[06-BUGS]]
- Aprendizado: [[learning/00-LEARNING-HUB]] → [[learning/LESSON-INDEX]]

## Sessões

- [[sessions/interruption-checkpoint-001]]

## Regra de retomada

Ler primeiro [[10-CONTEXT-FEEDING-RULE|START HERE — Protocolo de contexto]],
depois [[01-CURRENT-STATE]] e o checkpoint da sessão.

O checkout principal é `C:\Users\pedro\Documents\APP PITECO`, na branch
`main`. Worktrees de tarefa ficam em
`C:\Users\pedro\Documents\App-Piteco-Worktrees\`. Nunca usar
`AppData\Local\Temp` como local permanente.

Ver [[23-GIT-E-WORKTREES]] para a regra completa. Não declarar publicação
pronta sem validação visual real.
