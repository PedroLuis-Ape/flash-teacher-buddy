---
category: agent
area: codex
status: active
cssclasses:
  - ape-ai-note
---

# Agentes e coordenação

## Skills obrigatórias

- `piteco-second-brain-protocol` — preflight, memória operacional, grafo e
  fechamento em `docs/brain/`.
- `piteco-adaptive-learning-loop` — recuperação de lições, hipótese, evidência,
  diagnóstico, reteste e promoção controlada.

O repositório `docs/brain/` é a única memória operacional ativa. Git é a fonte
canônica do código; a cópia externa migrada permanece somente como ponte
histórica.

## Trabalho efetivamente registrado

- Controller principal: coordena plano, revisão e integração.
- Bernoulli: implementação do shell e correção do safe-area; commit `cc6ccc45`.
- Auditorias read-only: Home, navegação, biblioteca, turmas e overlays em `docs/agent-orchestration/`.

## Limite operacional

A tentativa de executar 30 funções encontrou o limite de threads do ambiente. Foram definidos papéis e escopos no master plan, mas não se deve afirmar que 30 agentes executaram trabalho.

## Regra para próximos agentes

Escopo de escrita disjunto, sem Supabase/auth/dados. Cada entrega deve incluir arquivos alterados, testes executados, limitações e commit lógico. Agentes concluídos devem ser encerrados antes de abrir novos.

## Time CLARA — subagentes padrão (vigente em 2026-09-14)

`[DECISION]` O time global CLARA é o conjunto padrão de subagentes do App Piteco: `clara_brain`,
`clara_explorer`, `clara_worker` e `clara_reviewer`, sempre spawnados com `agent_type` explícito.
Registrado também no `AGENTS.md` do repositório. Fluxo: Brain (Context Packet) → Explorer
(Exploration Pack) → Worker (Implementation Report) → Reviewer (Review Report) → Brain
(conhecimento durável).

`[SUBSTITUI]` A decisão de 2026-09-12 fixava as Claras em DeepSeek `deepseek/deepseek-v4-flash`
com `model_reasoning_effort = "ultra"`. A política vigente é `gpt-5.6-luna` + `high`, sem `xhigh`,
sem `ultra` e sem escalonamento automático; a MAIN mantém o próprio modelo e decide qualquer troca
quando um subagente devolve BLOCKED.

Segue valendo a regra desta nota: escopo de escrita disjunto, sem Supabase/auth/dados; subagente
concluído é encerrado antes de abrir o próximo; nenhum subagente substitui os gates técnicos
(`brain:check`, `typecheck`, `test`, `lint`, `build`).

## Contexto adaptativo e CCL (2026-09-13)

`[DECISION]` Representação adaptativa adotada: **NATURAL** (informação nova/complexa/crítica),
**NATURAL_SHORT** (< ~35 palavras equivalentes), **CCL_L1** (contexto compartilhado em handoff/delta),
**CCL_L2** (somente WARM + `rv` conferido + refs conhecidas). **CCL v3 é a versão estável e está
congelado** — sem micro-otimização de wire sem evidência material. Registry do projeto em
[[25-CCL-REGISTRY]] (`docs/brain/registry/ccl-registry.json`).

`[DECISION]` Regras operacionais: retrieval **sempre seletivo** e só com reutilização prevista;
**nunca** carregar o vault inteiro; conhecimento conhecido e ainda válido não é retransmitido
(REFERENCE + DELTA); contexto WARM é invalidado quando registry, contrato, branch ou Brain mudam;
divergência memória × realidade marca `BRAIN_CONFLICT` / `NEEDS_RECONCILIATION` e **nunca** é
reconciliada em silêncio. Ver [[27-CONTEXT-PACKET-E-TELEMETRIA]] e [[10-CONTEXT-FEEDING-RULE]].

Related: [[04-DECISIONS]] · [[10-CONTEXT-FEEDING-RULE]] · [[25-CCL-REGISTRY]] · [[27-CONTEXT-PACKET-E-TELEMETRIA]]
