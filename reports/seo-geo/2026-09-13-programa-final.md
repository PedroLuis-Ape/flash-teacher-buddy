# Programa de Descoberta, Ativação e Identidade — evidência de fechamento

Data: 2026-09-13 · Branch: `integration/ape-program-20260913` (LOCAL)
Worktree: `C:\Users\pedro\Documents\App-Piteco-Worktrees\ape-discovery-activation-20260913`
Base: `origin/main` = `9606c902`

## Escopo entregue

| Fase | Entrega | Estado |
| --- | --- | --- |
| 0 | Baseline técnico (typecheck, suíte, lint, build, SEO, preview smoke) | concluída |
| 1 | Home pública com destaque real, CTA de ativação e carrossel acessível | integrada |
| 2 | Identidade cromática própria (teal/índigo/âmbar), fonte única de tokens | integrada |
| 3 | Continuidade visitante → conta (ponte, pergunta única, convite) | integrada |
| 4 | Materiais curados + catálogo público com busca, filtros, pré-render, canonical e sitemap | integrada |
| 5 | GEO (JSON-LD fiel, crawlers de assistentes, IndexNow) + medição first-party sem PII | integrada |

## Evidência de execução (última rodada, neste HEAD)

```
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json   -> exit 0
node node_modules/vitest/vitest.mjs run                            -> 276 arquivos / 1709 testes PASS
npm run build                                                       -> exit 0
  OK material publico: canonical unico, robots autoritativo, H1, JSON-LD fiel e sitemap sem filtros
  APE SEO visibility score: 100/100 (todas as 5 dimensões 20/20)
  Orçamento do bundle aprovado
node scripts/brain-check.mjs                                        -> BRAIN_CHECK_PASS (47 notas, 505 wikilinks)
```

### HTML pré-renderizado do catálogo (inspeção literal)

```
pt-br | h1=Materiais para praticar inglês         | 1 canonical | 1 robots
en    | h1=Materials for practising English      | 1 canonical | 1 robots
es    | h1=Materiales para practicar inglés      | 1 canonical | 1 robots
fr    | h1=Supports pour pratiquer l'anglais     | 1 canonical | 1 robots
it    | h1=Materiali per esercitarsi in inglese  | 1 canonical | 1 robots
estado vazio de cada locale no idioma correto, vindo de src/i18n/resources/<locale>/home.json
sitemap-materials.xml: 5 URLs base, nenhuma com querystring
```

## Evidência de banco (produção `ymahldldyxvwjeruaxpr`)

```
public_resource_editorial      -> 5 linhas, todas draft / is_indexable = false (intocadas)
list_public_resources_v1       -> exatamente 1 overload; smoke: items[], total 0
get_public_resource_v1         -> canonical_path com lower(locale)
list_public_resources_v1       -> canonical_path com lower(locale)
product_event                  -> RLS on, 0 policies, anon sem SELECT/INSERT, sequência revogada
record_product_event_v1        -> SECURITY DEFINER, search_path fixo, allowlist escalar, tokens validados,
                                  throttle serializado por advisory lock; payload aninhado descartado (testado)
0 linhas de teste deixadas na tabela
```

## Revisões independentes (Claras / DeepSeek) e desfechos

| Alvo | Achados | Desfecho |
| --- | --- | --- |
| Catálogo T1 (RPC) | Spec ✅, 2 Minor | aprovado, minors deferidos |
| Catálogo T2 (página) | 3 Important | fix round + re-review: todos addressed |
| Catálogo T3 (pré-render) | 2 Important + 6 Minor | canonical e i18n corrigidos neste HEAD |
| Fase 5 T1 (GEO) | 1 Critical + 1 Important + 1 Minor | fix round + re-review: todos addressed |
| Fase 5 T2 (eventos) | 4 Important + 2 Minor | fix round + re-review: todos addressed |
| Fase 5 T3 (instrumentação) | 4 Important + 5 Minor | fix round + re-review: todos addressed |
| Auditoria de integração | 1 Important + 5 Minor | canonical corrigido; minors registrados |
| R-2026-09-13-01 (Clara Worker) | — | commit `1112091a`, gate de autoria nos 4 builders |

Principais defeitos reais encontrados por revisão e corrigidos: autoria inventada no JSON-LD (material e
listas/pastas), bypass da allowlist de eventos por objeto aninhado, `locale`/`surface` como texto livre,
throttle não atômico, `has_filters` constante, locale rotulado como pt-BR, ausência de portão de ambiente
na medição, `canonical_path` com locale maiúsculo (quebrava o primeiro material aprovado) e copy do
catálogo em português nos 5 locales.

## Decisões vigentes

- Curadoria é decisão humana: as 5 linhas seguem em `draft`; nada fica indexável sem aprovação do Pedro.
- JSON-LD é emitido só no pré-render (evita bloco duplicado clonado pelo SPA).
- `noindex` de URL filtrada é runtime; a proteção real é canonical para a base + nenhuma URL com filtro no sitemap.
- Throttle de eventos é global por nome (sem PII não há como identificar origem) — limitação aceita e documentada.
- A branch é LOCAL: nada foi pushado, mesclado ou publicado na Lovable.

## Pendências reais

1. Aprovação dos 5 materiais de curadoria pelo Pedro (sem isso o catálogo mostra o estado vazio honesto).
2. Minor de revisão registrados no Segundo Cérebro, nenhum bloqueante.
3. `P0` herdado de fase anterior: as RPCs `get_public_learning_list*` não existem em produção —
   `/portal/list/:id` segue indisponível e isso é anterior a este programa.

## Próximo passo planejado (não iniciado)

Implementar o **Modo Reino Beta público**, com SEO, Guest Mode e uso exclusivo do modo misto gamificado.
A especificação `APE_Modo_Reino_Beta_Prompt_e_JSON_v1_1.json` ainda não foi lida nem versionada; lê-la e
reconciliar com o SEO público, o Guest Mode e o Study Engine é a primeira ação. Nada deve começar antes
de o Pedro decidir.

