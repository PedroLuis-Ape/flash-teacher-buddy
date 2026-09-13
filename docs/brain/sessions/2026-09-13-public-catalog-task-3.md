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

# Session — Catálogo público: pré-render, canonical e sitemap (Task 3)

## Objective

Fechar a Task 3 do plano `docs/superpowers/plans/2026-09-13-ape-public-catalog.md`:
pré-renderizar o catálogo `/{locale}/materiais`, tornar canonical e robots
autoritativos no HTML servido a crawlers e listar o catálogo no sitemap.

## Starting state

Branch `feat/ape-public-catalog-20260913`, HEAD `6f15bad4`.
Tasks 1 e 2 completas e revisadas. O catálogo não tinha HTML pré-renderizado e o
helper `applyHead` não neutralizava o `<meta name="robots">` estático do shell.

## Work performed

- validador novo escrito primeiro e rodado em vermelho (`DEFAULT_ROBOTS` e
  `renderCatalogStaticContent` ainda não existiam);
- `scripts/public-material-data.mjs` passou a expor `publicCatalogPath` e a
  devolver `catalogs` do mesmo carregamento que já alimenta os materiais;
- `scripts/prerender-public-materials.mjs` ganhou `DEFAULT_ROBOTS`,
  `renderCatalogStaticContent`, remoção do robots estático no `applyHead`,
  geração das 5 páginas de catálogo e guarda `isDirectExecution`;
- `package.json` passou a rodar o validador no build;
- `npm run build` completo executado.

### Descoberta durante a execução

O validador acusou querystring no sitemap por causa da declaração
`<?xml ... ?>` do próprio XML. A asserção era ingênua: passou a inspecionar
apenas os `<loc>`. Lição: validar o campo, não o arquivo inteiro.

## Files changed

`scripts/validate-public-material-prerender.mjs` (novo),
`scripts/prerender-public-materials.mjs`, `scripts/public-material-data.mjs`,
`package.json`, `docs/brain/01-CURRENT-STATE.md`.

## Validation

- validador dedicado: PASS (canonical único, robots autoritativo, H1, sitemap sem filtros)
- `npm run build`: PASS, exit 0
- `seo:visibility:score`: 100/100
- bundle: aprovado dentro do orçamento
- `dist/pt-br/materiais/index.html`: 1 canonical, 1 robots, 1 H1, estado vazio honesto

## Discovery

A duplicação de política de robots não era um problema do catálogo: era do
helper compartilhado, e afetava toda página pré-renderizada.

## Risks / limitations

- [REVALIDATE] Nenhum item real de catálogo pôde ser renderizado, porque a
  curadoria segue em rascunho e aprovar conteúdo é decisão do Pedro.
- [KNOWN-LIMIT] O shell do SPA continua com canonical raiz estático.

## Next step

Task 4: evidência final, atualização do Segundo Cérebro e registro do próximo
passo planejado (Modo Reino Beta público).

## Classification

REVIEW_RECOMMENDED — implementado pelo controller porque a capacidade de
subagente estava bloqueada por limite de uso; a revisão independente continua
obrigatória antes de marcar a task como concluída.

