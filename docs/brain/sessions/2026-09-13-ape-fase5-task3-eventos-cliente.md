---
type: session
date: 2026-09-13
agent: codex-orchestrator
area: seo-public-web
related:
  - "[[01-CURRENT-STATE]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
---

# Session — Fase 5, Task 3: helper de cliente e instrumentação

## Objective

Emitir os 11 eventos da allowlist a partir das superfícies reais, sem PII e sem
nunca quebrar a experiência do visitante.

## Decisão de arquitetura anterior a esta task

Descobriu-se que as fases 1, 2 e 3 estavam em branches **paralelas** a partir de
`origin/main`, nunca integradas. A Fase 5 depende de superfícies da Fase 1
(destaque, carrossel) e da Fase 3 (guest), então o programa foi integrado na
branch `integration/ape-program-20260913` (merges `ddd20ec5`, `a0e536c7`,
`b73c9f26`) antes da instrumentação. Conflitos resolvidos em `src/App.tsx`
(mantido o `InstitutionProvider` da Fase 1 + rotas novas de material/catálogo),
nos 5 `home.json` (união das chaves) e em `01-CURRENT-STATE.md`.

## O que foi implementado

- `src/lib/productEvents.ts`: `trackProductEvent` / `trackProductEventOnce`.
  Nunca lança, nunca bloqueia render, filtra o payload pela mesma allowlist do
  servidor e ignora nome desconhecido sem chamar a RPC.
- `public_search_used` envia apenas `result_count` e `has_filters` — o termo
  digitado nunca sai do navegador.
- `guest_game_start` / `guest_game_complete` só disparam para visitante
  (`authUserId`/`userId` ausente) e uma vez por recurso.
- Os 11 eventos da allowlist estão instrumentados: destaque (impressão e
  clique), carrossel (visualização e interação), material, catálogo, guest
  (resume, início e conclusão de jogo) e conversão (CTA e decisão).

## Validation

- `productEventsClient.test.ts`: 7/7 (allowlist, erro de RPC, rede offline, once).
- `productEventInstrumentation.contract.test.ts`: 7/7 (cada superfície chama o
  evento certo; nenhum payload leva id de usuário).
- Suíte completa: 273 arquivos / 1693 testes PASS · typecheck 0 ·
  `npm run build` exit 0 com SEO 100/100 · `brain:check` PASS.

## Risco conhecido

[REVALIDATE] Os eventos foram validados por teste de contrato e pelo schema real
da RPC, mas ainda não houve coleta de tráfego real de visitantes.

## Next step

Task 4 da Fase 5: evidência final, atualização do Segundo Cérebro e registro do
próximo passo (Modo Reino Beta público).

## Classification

REVIEW_RECOMMENDED — implementado pelo controller; revisão independente pendente.

