---
cssclasses:
  - ape-ai-note
---

# Decisions

## DEC-001 — Preset ≠ sessão
Preset = preferência normal. Sessão = estado exato da partida.

## DEC-002 — Persistência autônoma
Salvar continuamente, não depender apenas de unload.

## DEC-003 — Resume preserva ordem
Não rerandomizar `cardsOrder` de sessão válida.

## DEC-004 — Glossário híbrido
Base/global + contexto do card + expressão.

## DEC-005 — Sem LLM no clique
IA trabalha no enriquecimento/import/review; runtime consome persistido.

## DEC-006 — Backup/export comum é lossless
Não reinterpretar semanticamente.

## DEC-007 — Export semântico carrega evidência
Frase, lado oposto, idiomas, contexto, expressão e posição/card ref.

## DEC-008 — Mobile first
UI relevante testada em viewports pequenas.

## DEC-009 — Evolução visual, não redesign
Preservar identidade Piteco.

## DEC-010 — Motion tem função
Efeito comunica estado/feedback.

## DEC-011 — Rewrite auditivo
LISTENING → REVIEW → REWRITE → COMPLETED.

## DEC-012 — Deploy frontend = Lovable
Commit GitHub não equivale a publicação.

## DEC-013 — Agentes não trabalham direto em main
Mudanças isoladas e revisáveis.

## DEC-014 — Luna prepara, Astra fecha
Classificação: FINAL / REVIEW_RECOMMENDED / PARTIAL_SAFE / BLOCKED.

## DEC-015 — Máximo ~6 agentes concorrentes
Supervisor + Core/Data + Games/Study + UI/Mobile + Content + QA.

## DEC-016 — Obsidian é memória operacional
GitHub continua canônico para código.

## DEC-017 — visitante público não grava estado privado no servidor
**[HISTÓRICO/REVALIDAR]**

## DEC-018 — lado principal ≠ direção temporária
**[HISTÓRICO + schema corroborado]**
`lists.primary_side` é propriedade persistente da lista; direção é sessão/configuração.
