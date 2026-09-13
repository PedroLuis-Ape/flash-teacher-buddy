# Catálogo público curado — evidência de fechamento (Fase 4, bloco final)

Data: 2026-09-13 · Branch: `feat/ape-public-catalog-20260913`
Worktree: `C:\Users\pedro\Documents\App-Piteco-Worktrees\ape-discovery-activation-20260913`
Base: `origin/main` = `9606c902` (a branch empilha sobre `feat/ape-public-materials-20260913`)

## O que mudou

| Commit | Entrega |
| --- | --- |
| `d7045828` | Plano versionado em `docs/superpowers/plans/2026-09-13-ape-public-catalog.md` |
| `a3cd2d26` | RPC `list_public_resources_v1` com busca, filtros, `total`, `has_more` e facetas; migration aplicada em produção |
| `88c63d2c` | Rota pública `/:locale/materiais` com busca, filtros, três estados vazios distintos e canonical/noindex por URL |
| `6f15bad4` | Fix round 1: validação de contrato da RPC e matriz mobile completa |
| `4af5eb3d` | Pré-render das 5 páginas de catálogo, canonical e robots autoritativos, sitemap sem filtros |

## Evidência de banco (produção `ymahldldyxvwjeruaxpr`)

```
pg_proc  -> list_public_resources_v1(text,text,text,text,text,integer,integer)
            security_definer = true · search_path = public · anon EXECUTE = true
            (exatamente 1 overload; a assinatura antiga de 3 parâmetros foi removida)
smoke    -> {"items": [], "total": 0, "has_more": false,
             "facets": {"levels": [], "resource_types": [], "themes": []}}
curadoria-> status = draft · is_indexable = false · 5 linhas
```

A curadoria foi deliberadamente mantida intacta: aprovar material é decisão do Pedro,
e nenhuma migration deste bloco alterou `status` ou `is_indexable`.

## Evidência de build

```
node node_modules/vitest/vitest.mjs run
  Test Files  266 passed (266)
  Tests       1642 passed (1642)

node node_modules/eslint/bin/eslint.js .
  72 problems (0 errors, 72 warnings)   <- baseline pré-existente, nenhum novo

npm run build                         -> exit 0
  Materiais públicos validados: 8 recursos reais e contrato sintético completo.
  OK catalogo publico: canonical unico, robots autoritativo, H1 e sitemap sem filtros.
  Bundle JS total (gzip): 1100.3 KiB — orçamento aprovado.
  APE SEO visibility score: 100/100

node scripts/brain-check.mjs
  Notes: 41; wikilinks: 443; BRAIN_CHECK_PASS
```

## Evidência do HTML pré-renderizado

`dist/pt-br/materiais/index.html` (inspeção literal):

```
canonicals   = 1
  https://www.apeeducation.org/pt-br/materiais
robots       = 1
  index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1
h1           = 1
  <h1>Materiais para estudar inglês</h1>
estado vazio = presente ("Ainda não há materiais publicados neste idioma.")
marcador     = data-public-catalog="pt-br"
```

`dist/sitemap-materials.xml` lista as 5 URLs de catálogo e nenhuma com querystring:

```
/pt-br/materiais · /en/materiais · /es/materiais · /fr/materiais · /it/materiais
```

### Causa-raiz corrigida nesta task

O helper compartilhado `applyHead` já removia o `<link rel="canonical">` estático do
shell, mas não o `<meta name="robots">` de `index.html:74`. Toda página
pré-renderizada saía com **duas** políticas de robots conflitantes. A correção foi
feita no helper compartilhado, não em uma cópia do catálogo.

## Limitações honestas

- Nenhum item real de catálogo pôde ser renderizado: não há curadoria aprovada.
  O caminho populado está coberto por asserções de função pura, não por tela real.
- No SPA sem pré-render o shell mantém o canonical raiz estático ao lado do
  emitido por `SEOHead`. As rotas públicas afetadas são pré-renderizadas;
  resolver o shell globalmente continua pendente.
- A revisão independente da Task 3 e a revisão final da branch **não** foram
  executadas: a conta atingiu o limite de uso de subagentes. Nenhuma task deste
  bloco foi declarada concluída sem revisão; a Task 3 está rotulada REVALIDATE.

## Rollback

- Código: reverter os commits em ordem inversa (`4af5eb3d`, `6f15bad4`, `88c63d2c`, `a3cd2d26`).
- Banco: o bloco de rollback está escrito em
  `supabase/migrations/20260913180000_public_resource_catalog_v1.sql` (recria a
  assinatura antiga de 3 parâmetros a partir do backup registrado e restaura ACL).
  A tabela `public_resource_editorial` não é afetada por este rollback.
- `git stash@{0}` (`task-3-partial-averroes-usage-limit`) guarda o trabalho parcial
  abandonado de uma tentativa anterior; pode ser descartado sem impacto.

## Próximo passo planejado

Implementar o **Modo Reino Beta público**, com SEO, Guest Mode e uso exclusivo do
modo misto gamificado. Registrado em [[01-CURRENT-STATE]] e [[09-ASTRA-HANDOFF]].
Não iniciar antes de fechar as revisões pendentes deste bloco.

