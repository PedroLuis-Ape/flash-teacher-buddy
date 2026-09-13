---
type: session
date: 2026-09-13
agent: codex-orchestrator
area: seo-public-web
related:
  - "[[01-CURRENT-STATE]]"
  - "[[08-RISKS]]"
  - "[[07-TESTS]]"
---

# Session — fix round do catálogo: canonical em minúsculo e copy por locale

## Origem

Auditoria de integração (Clara Reviewer) e revisão da Task 3 do catálogo
apontaram, de forma independente, o mesmo defeito: o RPC montava
`canonical_path` com o code do locale (`pt-BR`) enquanto rota, gate público e
prerender usam o segmento minúsculo (`pt-br`).

## O que foi corrigido

- [CONFLITO] `canonical_path` agora é emitido em minúsculo por
  `get_public_resource_v1` e `list_public_resources_v1` (migration
  `20260913210000_public_resource_canonical_lowercase_v1.sql`). Aplicada em
  produção e verificada: as duas funções contêm `lower(...)`, há exatamente 1
  overload e o smoke devolve o payload vazio esperado.
- [DEFESA] `isProtectedPath` normaliza o caminho para minúsculo antes de
  comparar, então mesmo um link com `pt-BR` (ou digitado à mão) não cai mais no
  gate de rota protegida e não devolve página vazia ao visitante anônimo.
- [CONTRATO] `publicMaterialCanonicalLocale.contract.test.ts` falha se os RPCs
  voltarem a concatenar `locale` cru na URL.
- [I18N] A copy do catálogo no prerender deixou de ser um dicionário paralelo:
  agora lê `src/i18n/resources/<locale>/home.json` (fonte única com o runtime).
  Verificado no HTML servido: os 5 locales têm H1 e estado vazio no idioma certo,
  cada um com 1 canonical e 1 robots.

## Decisão registrada (limitação aceita)

[DECISION] A regra "URL com filtro sai `noindex, follow`" é aplicada no runtime
(`PublicCatalogPage`), não no HTML pré-renderizado: o arquivo estático é o mesmo
para a URL base e para a URL com querystring. O mecanismo que protege a
indexação errada é o canonical apontando para a base, e nenhuma URL com filtro
entra no sitemap. Aceito e documentado em vez de adicionar regra de borda.

## Dívida relacionada

R-2026-09-13-01 (autoria inventada em listas/pastas públicas) foi paga pela
Clara Worker no commit `1112091a`, com teste e validadores; o ramo anônimo está
provado por fixture porque hoje todo material público real tem autor.

## Gates

typecheck 0 · 276 arquivos / 1709 testes PASS · `npm run build` exit 0 com SEO
100/100 · `brain:check` PASS.

