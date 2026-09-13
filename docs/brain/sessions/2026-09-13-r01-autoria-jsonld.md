---
type: session
date: 2026-09-13
agent: clara-worker
area: seo-public-web
related:
  - "[[01-CURRENT-STATE]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
---

# Session — R-01: autoria inventada no JSON-LD de pastas e listas públicas

## Objective

Aplicar aos quatro caminhos públicos irmãos a mesma regra já vigente no material
curado: JSON-LD só descreve o que existe no payload e, portanto, no HTML visível.

## Starting state

[VERIFIED-REPO] Os quatro builders emitiam `Person` com
`name: <autor> || "Professor no APE"` e `jobTitle: "Professor"` mesmo sem
`author_display_name` e sem `author_slug`, e sempre referenciavam
`author: { "@id": authorId }`. Em pastas/listas sem autor isso inventava autoria
e criava referência pendurada para um nó `Person` fabricado.

## Work performed

- `hasAuthor = Boolean(author_display_name || author_slug)` nos quatro builders;
  sem autor, o `@graph` não contém `Person` nem a chave `author`.
- Com autor, nada mudou: nome, `jobTitle`, `url`, `image` e `memberOf` idênticos,
  e a referência `author` continua apontando para o `Person` emitido.
- Textos visíveis e HTML estático intactos: a mudança é só no grafo JSON-LD.
- Contrato coberto por teste Vitest novo
  (`src/components/seo/publicLearningAuthorshipJsonLd.test.ts`) para os builders
  TS e, via validador de build, para os builders `.mjs` de pré-render.
- Validadores de build passaram a exigir o gate e imprimem
  `AUTORIA-GATE com-autor OK` / `AUTORIA-GATE sem-autor OK`; as checagens que
  dependem de artefatos de `dist/` viraram condicionais para o validador também
  rodar fora do build (o build continua validando dist por inteiro).

## Contracts that must not break

- Só existe `Person` quando existe `author_display_name` **ou** `author_slug`.
- A referência `author` nunca fica pendurada.
- JSON serializado sem `null` e sem `undefined`.

## Validation

- RED antes da correção: teste Vitest novo falhou nos dois builders TS
  (`sem autor não pode existir Person: expected true to be false`) e os dois
  validadores falharam com `JSON-LD nao pode inventar autor`.
- GREEN: 9 testes focados passam; `tsc` 0; 275 arquivos / 1706 testes passam;
  `npm run build` exit 0 com `seo:visibility:score` 100/100; `brain:check` PASS.
- Varredura do `dist/` recém-gerado: 35 blocos JSON-LD, 0 referências penduradas,
  0 `null`/`undefined`.

## Files changed

- `scripts/prerender-public-learning-resources.mjs`
- `scripts/prerender-public-learning-lists.mjs`
- `src/components/seo/publicLearningResourceStructuredData.ts`
- `src/components/seo/publicLearningListStructuredData.ts`
- `scripts/validate-public-learning-resource-prerender.mjs`
- `scripts/validate-public-learning-list-prerender.mjs`
- `src/components/seo/publicLearningAuthorshipJsonLd.test.ts`

## Risk / next step

- Os 35 blocos reais atuais têm autor; o ramo anônimo está provado por fixture
  sintética, não por dado real — revalidar quando surgir pasta/lista sem autor.
- A reconciliação do risco em [[08-RISKS]] (marcar R-2026-09-13-01 como
  resolvido) ficou com o supervisor: o arquivo tinha edição em andamento de
  outro agente e não foi tocado por esta task.

## Classification

REVIEW_RECOMMENDED

