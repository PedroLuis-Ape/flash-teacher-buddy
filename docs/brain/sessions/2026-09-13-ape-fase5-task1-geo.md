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

# Session — Fase 5, Task 1: GEO (JSON-LD, crawlers de assistentes, IndexNow)

## Objective

Tornar o material curado citável por buscadores e assistentes: dados
estruturados fiéis ao HTML, crawlers de assistentes liberados só nas
superfícies curadas e material incluído no ciclo do IndexNow.

## Decisões de arquitetura

- [DECISION] O JSON-LD vive **apenas no HTML pré-renderizado**. Crawlers de
  assistentes (OAI-SearchBot e afins) não executam JavaScript; emitir também no
  SPA produziria dois blocos idênticos na mesma página. Descartada a ideia
  inicial de um builder em TS no cliente.
- [DECISION] O IndexNow não precisou de código novo: `scripts/submit-indexnow.mjs`
  já coleta o `sitemap.xml` raiz e todos os sitemaps referenciados, e
  `sitemap-materials.xml` (catálogo + materiais) já está referenciado.

## O que foi implementado

- `buildMaterialJsonLd(material)`: `@graph` com `WebPage`, `LearningResource`,
  `Person` e `BreadcrumbList` (Portal → Materiais → material). Só entra campo
  que existe no payload: nível, tema, tipo, resumo e data de revisão são
  omitidos quando ausentes, nunca preenchidos com null ou valor inventado.
- `injectMaterialStructuredData(html, material)`: injeta o script no HTML final.
- `public/robots.txt`: bloco `User-agent: OAI-SearchBot` liberando apenas
  `/{locale}/materiais` e `/{locale}/material/` nos cinco locales, com
  `Disallow: /` fechando o resto do site.
- Validador do build passou a exigir: JSON-LD parseável com `LearningResource` e
  `BreadcrumbList`, ausência de `null`/`undefined`, omissão dos campos
  ausentes, injeção real no HTML e o bloco de assistentes no robots.txt.

## Validation

- `node scripts/validate-public-material-prerender.mjs`: PASS
- `npm run build`: exit 0 · `seo:visibility:score` 100/100 · bundle aprovado
- `dist/sitemap.xml` referencia `sitemap-materials.xml` (prova do ciclo IndexNow)

## Risco conhecido

[REVALIDATE] Com zero curadorias aprovadas, nenhuma página de material é
gerada no build. O caminho de injeção está coberto por fixture no validador,
não por uma página real — aprovar um material é o que fecha essa verificação.

## Next step

Task 2 da Fase 5: infraestrutura de eventos first-party (tabela + RPC com
allowlist, limite de payload e throttle).

## Classification

REVIEW_RECOMMENDED — implementado pelo controller; revisão independente pendente.

