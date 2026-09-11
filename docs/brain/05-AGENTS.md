---
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
