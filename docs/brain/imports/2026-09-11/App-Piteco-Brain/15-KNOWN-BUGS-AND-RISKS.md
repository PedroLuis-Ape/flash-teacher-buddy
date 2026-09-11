---
cssclasses:
  - ape-ai-note
---

# Known Bugs and Risks

## RISK-001 — Supabase errado
**Crítico.**
Produção e admin têm refs diferentes. Nunca trocar.

## RISK-002 — código de sessão mais avançado que schema admin
**Alto.**
Código suporta snapshots/revision/RPC modernos; admin inspecionado não mostra esses campos. Produção não pôde ser introspectada.

## RISK-003 — resume / empty order
**Alto.**
Histórico de `ST-empty-order`. Guards existem, mas resume continua crítico.

## RISK-004 — multi-tab/conflict
**Alto.**
Há outbox e revision protection. Reconciliação interativa foi registrada como pendência.

## RISK-005 — Rewrite recém-implementado sem QA visual autenticado
**Médio/alto.**

## RISK-006 — importadores parcialmente verificados no runtime/mobile
**Médio/alto.**

## RISK-007 — replace de glossário em múltiplos lotes
**Médio.**
Não é transação global.

## RISK-008 — collection/list adapter identity
**Médio.**
Não assumir equivalência de IDs.

## RISK-009 — extensão injeta content script em todos os HTTP/HTTPS
**Médio.**
Aumenta superfície e revisão da Web Store.

## RISK-010 — docs históricas podem estar superadas
Ex.: `status_group_uid` inexistente em junho, presente agora no admin.

## Achados antigos a revalidar
- side effects de economia em páginas públicas;
- SessionWatcher com duas responsabilidades;
- limpeza global de storage/cache;
- freeze watchdog;
- identidade favorito/vermelho após merge;
- offline antigo sem identidade de camadas.

Não tratar como bug atual sem conferir código.

## Segurança
- nenhuma migration remota automática;
- nenhum fallback fictício;
- nada de “limpa storage” para esconder sessão;
- nenhum bypass de RLS.
