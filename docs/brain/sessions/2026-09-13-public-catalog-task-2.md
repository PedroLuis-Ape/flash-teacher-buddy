---
cssclasses:
  - ape-ai-note
type: session
date: 2026-09-13
agent: codex
area: public-activation
status: done-with-concerns
related:
  - "[[01-CURRENT-STATE]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[areas/visual-polish]]"
---

# Sessão — Catálogo público com busca e filtros

## Objetivo

Implementar `/{locale}/materiais` sobre a RPC pública já aplicada, sem publicar
curadoria, inventar conteúdo ou criar uma segunda regra de elegibilidade.

## Preflight

- [VERIFIED-REPO] Worktree isolado na branch
  `feat/ape-public-catalog-20260913`, HEAD inicial `a3cd2d26`.
- [VERIFIED-REPO] O checkout já contém a RPC de sete argumentos e o contrato da
  página canônica individual.
- [DECISION] URL é a fonte compartilhável de busca e filtros; valores vazios
  enviados ao banco serão `null`.
- [DECISION] A página base é indexável; qualquer parâmetro `q`, `level`, `theme`
  ou `type` torna a URL `noindex, follow`, preservando canonical para a base.
- [RISK] O `Button` compartilhado usa `w-full` no mobile; ações compactas desta
  página precisam declarar `w-auto` para não repetir o empilhamento gigante.
- [RISK] Há alterações preexistentes e proibidas para commit em
  `supabase/functions/mcp/index.ts`, relatórios, lockfiles e `tmp/`.

## Predição

- Goal: catálogo honesto, público, acessível e mobile-first.
- Hypothesis: seguir `PublicResourcePage` + `usePublicResource`, com estado na
  URL e filtros progressivos, satisfaz o contrato sem tocar no banco.
- Expected result: contrato focado, typecheck, build e render 320/1440 passam;
  produção sem aprovações mostra o empty state de ausência de curadoria.
- Main risk: dessincronização entre input debounced, histórico e argumentos RPC.
- Evidence that confirms: RED diagnóstico, GREEN focado, inspeção dos requests e
  screenshots reais sem overflow.
- Evidence that falsifies: URL não acompanha controles, request recebe argumento
  diferente, canonical/robots incorreto ou overflow horizontal.
- Confidence: medium.

## TDD — RED

`node node_modules/vitest/vitest.mjs run src/features/public-materials/publicCatalog.contract.test.ts`
falhou em 7/7 asserções pela ausência esperada de rota, hook, página e chaves
i18n. O teste foi ajustado antes da produção para que o namespace ausente falhe
por asserção, não por `TypeError`.

## Próximo passo

Resolver no pipeline SEO compartilhado o canonical raiz duplicado e, após uma
aprovação editorial humana, repetir o QA visual dos cards com conteúdo real.

## Checkpoint de implementação e runtime

- [VERIFIED-TEST] O contrato principal passou 7/7 e, junto da página individual
  e sessão/rotas, passou 17/17.
- [PREDICTION-ERROR] O preflight presumiu que todos os locales já herdavam um
  prefixo público. Só `pt-br` e `en` herdavam; `es`, `fr` e `it` exigiram
  entradas explícitas para `/materiais`.
- [ROOT-CAUSE] A primeira versão do hook extraiu `publicSupabase.rpc` sem
  preservar `this`; o browser demonstrou falha antes da rede em `rest`. Um RED
  específico foi adicionado e o método passou a usar `bind(publicSupabase)`.
- [VERIFIED-RUNTIME] Playwright real, conectado à RPC de produção, recebeu o
  payload vazio esperado. Em 320 e 1440 px, `scrollWidth === viewportWidth`.
  Mobile mostra um único botão `Filtrar`; expandido, mostra três selects sem
  overflow. Desktop mostra três selects. O retry recuperou após duas falhas de
  rede simuladas; busca atualizou a URL em 500 ms sem aumentar `history.length`.
- [VERIFIED-RUNTIME] A base enviou filtros nulos; a URL completa enviou `verb`,
  `A1`, `gramatica` e `flashcards`. Os dois empty states têm textos distintos.
- [REVALIDATE] Não há linha aprovada para validar visualmente um card real. O
  card não recebeu fallback fictício e usa somente `canonical_path` e
  `play_path` do payload.
- [KNOWN-LIMIT] O shell Vite mantém o canonical raiz estático e o `SEOHead`
  acrescenta o canonical correto da rota; essa duplicidade preexistente será
  registrada no relatório, sem ampliar esta task para o pipeline global.

## Gates finais

- TypeScript app + node: PASS, 0 erros.
- Testes focados/rota/sessão: PASS, 3 arquivos e 17 testes.
- i18n: PASS, 5 idiomas e 563 chaves base.
- ESLint focado: PASS.
- Segundo Cérebro: PASS final, 40 notas e 436 wikilinks.
- Build: PASS, `seo:visibility:score` 100/100; dois warnings CSS preexistentes.

## ADAPTIVE LEARNING

- Prior lessons used: preserve empty states, mobile intrinsic button width and
  evidence before publication claims.
- Prediction error: route publicity was incomplete for three locales; extracting
  `rpc` was assumed safe but removed its receiver.
- Root cause: explicit prefix gaps and JavaScript method binding semantics.
- New lesson: [[learning/lessons/2026-09-13-supabase-rpc-method-binding]].
- Lesson status: `CANDIDATE_LESSON`, narrow and validated once.
- Anti-pattern/playbook update: none.
- Future plan changed by this learning: browser RPC smoke now follows typed SDK
  wrappers before accepting source-contract GREEN.

Related: [[01-CURRENT-STATE]] · [[07-TESTS]] · [[08-RISKS]] · [[areas/visual-polish]]

## Reabertura após revisão — contrato do payload e matriz mobile

- [VERIFIED-REPO] Branch `feat/ape-public-catalog-20260913`, HEAD de partida
  `88c63d2c`; alterações preexistentes/proibidas continuam fora do escopo.
- [ROOT-CAUSE] O boundary da RPC convertia payload `null`, array ou parcialmente
  tipado em catálogo vazio. Isso confundia quebra do contrato de transporte com
  ausência editorial válida e podia acionar mensagem enganosa ao usuário.
- [DECISION] A desserialização passa a ser estrita: estrutura raiz, itens,
  contagens, booleano e todas as facetas precisam respeitar o contrato. Falha
  lança erro para o React Query; somente o objeto vazio válido chega ao estado
  sem curadoria.
- [PREDICTION] Um teste unitário do parser deve falhar antes da implementação e
  passar depois; Playwright deve medir 320/360/375/390/430/1440 px com
  `scrollWidth <= innerWidth + 1`, incluindo filtros mobile abertos.
- [SCOPE] O canonical/meta estático do shell permanece explicitamente fora
  desta correção, conforme decisão da revisão.

## Fechamento da correção de revisão

- [VERIFIED-TEST] RED: 12/12 casos novos falharam porque o parser estrito ainda
  não existia; o contrato original permaneceu 7/7 verde.
- [VERIFIED-TEST] GREEN: contrato e teste de payload passaram 21/21. O fetch
  rejeita `data: null` e resolve o objeto vazio válido sem coerção.
- [VERIFIED-TYPECHECK] `tsc --noEmit -p tsconfig.app.json`: exit 0.
- [VERIFIED-RUNTIME] Chromium/Playwright real mediu base e filtros abertos em
  320/360/375/390/430 px: em todos, `scrollWidth === viewportWidth`, três
  selects visíveis quando abertos e nenhum erro de página/request. Desktop
  1440 px também teve `scrollWidth=1440` e três selects visíveis.
- [SELF-REVIEW] Validação cobre campos de cada item e cada faceta, além da raiz;
  não houve alteração em `PublicCatalogPage`, `SEOHead`, `index.html`, banco ou
  estado editorial.
- [ADAPTIVE-LEARNING] Coerção defensiva em boundary público pode apagar falha de
  infraestrutura e produzir mensagem de domínio falsa. A lição fica registrada
  nesta sessão como correção validada, sem promoção global nesta ocorrência.
