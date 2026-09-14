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
- [[27-CONTEXT-PACKET-E-TELEMETRIA]] — regra READ ONCE -> COMPACT -> SHARE ->
  REUSE, contexto compartilhado entre agentes e telemetria de custo de contexto.
- [[11-ARCHIVE-IMPORT-2026-09-11]] — conteúdo completo importado do ZIP.
- [[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]] — regras para manter o vault conectado.
- [[23-GIT-E-WORKTREES]] — checkout principal, pasta oficial de worktrees e regra de limpeza segura.
- [[24-SECURITY-AUDIT-2026-09-12]] — auditoria de segurança: causa-raiz das RPCs, correções e pendências.
- [[25-PUBLIC-ACTIVATION-PROGRAM]] — Home de ativação, destaque real, carrossel e pendências do programa público.
- [[25-CCL-REGISTRY]] — registry do protocolo CCL do projeto (Clara Compact Language) e regras de handoff entre agentes.
- [[README]] — declaração do vault canônico, proveniência e fonte de verdade.
- [[learning/00-LEARNING-HUB]] — aprendizagem por tentativa, evidência e reteste.

## Áreas

- [[areas/visual-polish]]
- [[areas/adaptive-learning]]
- [[areas/supabase-runtime]] — mapa canônico de dados, runtime e preflight.
- [[areas/motion-system]] — escopo proposto de motion e microinterações.
- [[areas/mcp-reference-ids-and-importers]] — Reference IDs, mapa de
  capacidades e caminhos oficiais de importação do MCP.

## Navegação por contexto

- Estado e retomada: [[01-CURRENT-STATE]] → [[12-PROCESS-LOG-2026-09-11]]
- Qualidade e evidências: [[07-TESTS]] → [[08-RISKS]]
- Decisões e problemas: [[04-DECISIONS]] → [[06-BUGS]]
- Aprendizado: [[learning/00-LEARNING-HUB]] → [[learning/LESSON-INDEX]]

## Sessões

- [[sessions/interruption-checkpoint-001]]
- [[sessions/checkpoint-2026-09-13-mcp-pause]] — parada com checkpoint completo do MCP (2026-09-13).
- [[sessions/checkpoint-2026-09-14-mcp-reference-importers]] — estado exato
  para retomar Reference IDs/importadores sem assumir que está pronto.
- [[sessions/2026-09-14-auditoria-de-continuidade]] — auditoria de continuidade:
  o que estava fora do main, o que foi consolidado e as atualizações de dependência pendentes.
- [[sessions/2026-09-14-publicacao-mcp-producao]] — migrations do MCP aplicadas em
  produção, defeito do guard de coleções automáticas, bloqueio do deploy da Edge Function e lacunas descobertas.
- [[sessions/2026-09-14-persistencia-e-listas-combinadas]] — persistência de estudo
  servidor-canônica e Listas Combinadas (relato de outra IA, verificado contra o main e o banco de produção).
- [[sessions/2026-09-14-configuracoes-da-sessao]] — contrato único das Configurações da
  Sessão: estado efetivo do Foco Vermelho, restauração ao desligar e persistência por patch semântico.
- [[sessions/2026-09-14-roteador-de-teclado]] — dono único do teclado da sessão (P0)
  e a fila do plano de reforma: TTS, gestos, runtime único, viewport, unificação Study/Mixed.

## Regra de retomada

**Primeiro passo de qualquer agente:** ler o bloco **FECHAMENTOS** no topo de
[[01-CURRENT-STATE]]. Ele tem, por data, o que ficou finalizado, até onde ficou
pronto e o que está em espera — é o que evita reler o vault inteiro.

Ler primeiro [[10-CONTEXT-FEEDING-RULE|START HERE — Protocolo de contexto]],
depois [[01-CURRENT-STATE]] e o checkpoint da sessão.

O checkout principal é `C:\Users\pedro\Documents\APP PITECO`, na branch
`main`. Worktrees de tarefa ficam em
`C:\Users\pedro\Documents\App-Piteco-Worktrees\`. Nunca usar
`AppData\Local\Temp` como local permanente.

Ver [[23-GIT-E-WORKTREES]] para a regra completa. Não declarar publicação
pronta sem validação visual real.
