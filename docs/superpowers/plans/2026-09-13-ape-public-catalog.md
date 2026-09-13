# APE — Catálogo Público de Materiais (Fase 4, bloco final)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a Fase 4 do programa de descoberta entregando o catálogo público navegável em `/{locale}/materiais`, com busca e filtros servidos pelo banco, alimentado exclusivamente por curadoria aprovada/indexável e sem criar um segundo sistema de publicação.

**Architecture:** A camada editorial já existe (tabela `public_resource_editorial`, RPCs `get_public_resource_v1` e `list_public_resources_v1`, página `/{locale}/material/{slug}`). Esta fase estende a RPC de listagem com busca, filtros, contagem total e facetas; adiciona a página de catálogo consumindo essa RPC por um hook React Query novo; e estende o pipeline de prerender/sitemap já usado pelos materiais. Nenhuma tabela nova, nenhum pipeline novo.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, shadcn/Radix, TanStack Query, Supabase/Postgres, Vitest, Playwright, Node 24.

**Spec:** Não há spec separada desta fase. A autoridade é o plano-mãe aprovado (Fase 4 do programa de descoberta/ativação) somado a este arquivo. Onde os dois divergirem, vale o plano-mãe.

## Global Constraints

- Nunca trabalhar em `main`. Um commit lógico por step relevante, uma branch por bloco de mudança.
- **Curadoria é decisão humana:** nenhuma linha de `public_resource_editorial` pode mudar de `draft` para `approved` nem receber `is_indexable = true` sem autorização explícita do Pedro. As migrations deste plano não podem alterar `status` ou `is_indexable` de nenhuma linha existente.
- **Sem segundo sistema de publicação:** reutilizar a regra pública vigente do portal (`folders.visibility = 'class'`, `class_id is null`, dono com `public_access_enabled`, título fora de `[Atribuição]%`) exatamente como as RPCs atuais já fazem. Não usar `public_entity_publications` (não existe em produção).
- **Quality gate no servidor é intocável:** continua exigindo `>= 8` cards ativos e `>= 90%` de termos únicos. A busca nunca pode contornar nem afrouxar esse gate.
- **Filtro e busca rodam no banco.** Nada de baixar a lista inteira e filtrar no cliente.
- **Indexação:** só a página base `/{locale}/materiais` é indexável. Qualquer URL com `?q=` ou filtro deve sair `noindex, follow` com `canonical` apontando para a base.
- **Reaproveitar o que existe:** `src/components/seo/*`, `scripts/public-material-data.mjs`, `scripts/prerender-public-materials.mjs`, `scripts/prepare-seo-sitemaps.mjs`. Não criar pipeline de SEO paralelo.
- **Segurança das funções:** `SECURITY DEFINER` com `search_path` fixo, `REVOKE` de `public`/`anon` e `GRANT` apenas do necessário. Nenhum PII no payload público.
- **pt-BR é o único conteúdo completo.** As 5 locales precisam existir nas chaves i18n; as outras 4 podem legitimamente renderizar lista vazia.
- **Banco de produção:** toda migration aplicada em produção (projeto `ymahldldyxvwjeruaxpr`) precisa de backup da definição anterior e bloco de rollback escrito no próprio arquivo da migration antes de ser aplicada.
- **Ruído que nunca entra em commit:** `supabase/functions/mcp/index.ts`, `dependency-audit-report.json`, `security-audit-report.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tmp/`, `reports/seo-visibility/latest-eval.json`.
- **Gates por task:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json` = 0 erros; testes focados verdes; `node scripts/brain-check.mjs` PASS. Gates do fechamento: suíte completa, `eslint .` sem novos erros, `npm run build` com `seo:visibility:score` = 100, `node scripts/preview-smoke.mjs` PASS.
- **Mobile é prioridade absoluta:** validar 320/360/375/390/430 px sem overflow horizontal e sem empilhamento de botões gigantes.

### Task 1: Busca, filtros, contagem e facetas na RPC de listagem

**Files:**
- Create: `supabase/migrations/20260913180000_public_resource_catalog_v1.sql`
- Create: `src/lib/__tests__/publicResourceCatalog.contract.test.ts`
- Modify: `scripts/public-material-data.mjs` (único consumidor da RPC; precisa acompanhar o novo formato)
- Modify: `docs/brain/01-CURRENT-STATE.md`

**Interfaces:**
- Consumes: tabela `public.public_resource_editorial`, regra pública vigente e quality gate já descritos na migration `20260913140000_public_resource_editorial_v1.sql`.
- Produces: `public.list_public_resources_v1(_locale text default 'pt-BR', _q text default null, _level text default null, _theme text default null, _resource_type text default null, _limit integer default 50, _offset integer default 0)` devolvendo **um objeto JSON**, não mais um array:
  `{"items": [{slug, title, folder_title, level, theme, resource_type, summary, card_count, author_name, author_slug, canonical_path, play_path}], "total": <int>, "has_more": <bool>, "facets": {"levels": [...], "themes": [...], "resource_types": [...]}}`
  onde cada item de faceta é `{"value": <text>, "count": <int>}`, ordenado por `count desc, value asc`.
- A assinatura antiga `(text, integer, integer)` precisa ser removida (`drop function if exists`) para não deixar duas sobrecargas ambíguas com `anon`.
- `_q` casa por `ILIKE '%' || _q || '%'` em `l.title`, `e.summary` e `e.theme`; `_level`/`_theme`/`_resource_type` casam exatamente (case-insensitive). Valores vazios ou `null` significam "sem filtro".
- `total` conta **todas** as linhas que passam nos filtros (sem `limit`); `has_more` é `(offset + cardinalidade dos itens) < total`.
- `facets` é calculado over **todas** as linhas aprovadas/indexáveis da locale (respeitando a regra pública e o gate), independente dos filtros aplicados, para a UI não colapsar as opções ao filtrar.

- [ ] **Step 1:** Escrever o teste de contrato `publicResourceCatalog.contract.test.ts` que lê o SQL da migration e afirma: `drop function if exists public.list_public_resources_v1(text, integer, integer)`; criação da nova assinatura de 7 parâmetros; `security definer`; `set search_path = public`; `revoke all` + `grant execute ... to anon, authenticated, service_role`; presença do quality gate (`>= 8` e `0.9`/`ceil`) tanto em `items` quanto em `facets`; e presença do bloco de rollback. Rodar e ver falhar (arquivo ainda não existe).
- [ ] **Step 2:** Tornar o contrato verde criando `supabase/migrations/20260913180000_public_resource_catalog_v1.sql` com: comentário de decisão, bloco de rollback, `drop function if exists` da assinatura antiga, `create or replace function` nova, `revoke`/`grant` atualizados. A função deve preservar **exatamente** os predicados públicos e o gate já existentes e adicionar os filtros sem duplicar a expressão de contagem de cards mais de uma vez por consulta.
- [ ] **Step 3:** Aplicar a migration em produção pelo conector Lovable (`project_id: b6f1ba83-b44c-4a41-8589-b1e5380cf1ea`) e registrar no relatório: definição anterior salva (backup), resultado da aplicação e o rollback exato. Verificar por consulta real que a nova RPC responde para `pt-BR` (esperado hoje: `items` vazio, `total` 0, pois nenhuma linha está aprovada) e que não há overload ambíguo (`pg_proc` deve listar uma única `list_public_resources_v1`).
- [ ] **Step 4:** Atualizar `scripts/public-material-data.mjs` para o novo formato (ler `.items`), sem mudar o comportamento do prerender de materiais.
- [ ] **Step 5:** Rodar o teste de contrato, `node scripts/brain-check.mjs` e `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json`. Atualizar `docs/brain/01-CURRENT-STATE.md` com a nova assinatura e o formato de retorno.
- [ ] **Step 6:** Commit `feat(public): busca, filtros e facetas no catalogo curado`.

### Task 2: Página pública do catálogo com busca e filtros

**Files:**
- Create: `src/features/public-materials/usePublicResourceCatalog.ts`
- Create: `src/features/public-materials/PublicCatalogPage.tsx`
- Create: `src/features/public-materials/publicCatalog.contract.test.ts`
- Modify: `src/App.tsx` (rota `/:locale/materiais`)
- Modify: `src/lib/sessionRouteAccess.ts` se a rota pública precisar de tratamento explícito
- Modify: `src/i18n/resources/{pt-BR,en,es,fr,it}/home.json` (ou o namespace público já usado pelos materiais)

**Interfaces:**
- Consumes: `list_public_resources_v1` (formato do Task 1), `publicSupabase` de `@/integrations/supabase/publicClient`, `normalizeAppLocale` e o padrão visual/estrutural de `PublicResourcePage.tsx`.
- Produces: rota pública `/:locale/materiais` renderizando (1) campo de busca com `label` acessível e debounce `>= 300ms`, (2) seletores de nível, tema e tipo alimentados por `facets`, (3) estado de resultado vazio honesto, (4) lista de cards com `title`, resumo, contagem de cards, autor e CTA "Jogar agora — sem cadastro" apontando para `play_path`, (5) link canônico para o material quando `canonical_path` existir, e (6) botão "Limpar filtros" quando houver filtro ativo.
- Estados obrigatórios: carregando, erro com "Tentar novamente" (refetch), vazio por ausência de curadoria publicada e vazio por filtro sem resultado — textos distintos, nenhum deles inventa conteúdo.
- A URL reflete busca e filtros (`?q=&level=&theme=&type=`) via `useSearchParams`, de forma que voltar/avançar funcione e a URL seja compartilhável.

- [ ] **Step 1:** Escrever `publicCatalog.contract.test.ts` (testes de markup/contrato com Testing Library ou inspeção de fonte, seguindo o padrão dos contratos existentes em `src/features/public-materials/`) afirmando: existência da rota `/:locale/materiais`; `label` acessível na busca; mapeamento dos 4 parâmetros de URL para os argumentos da RPC; presença dos três estados vazios distintos; CTA apontando para `play_path` do payload (nunca montado no cliente); `rel="canonical"` para a base quando houver query/filtro. Rodar e ver falhar.
- [ ] **Step 2:** Implementar `usePublicResourceCatalog.ts` com chave React Query própria (`["public","catalog", locale, q, level, theme, type, limit, offset]`) e `staleTime` de 5 minutos, reaproveitando o padrão de `usePublicResource.ts`.
- [ ] **Step 3:** Implementar `PublicCatalogPage.tsx` com os estados e a URL sincronizada, reaproveitando tokens de design e componentes shadcn já usados nas páginas públicas. Sem botões gigantes empilhados: no mobile os filtros entram em um painel progressivo ("Filtrar") e a lista ocupa a largura toda.
- [ ] **Step 4:** Registrar a rota e as chaves i18n nas 5 locales, com pt-BR completo e as demais traduzidas de forma revisada (sem tradução automática de conteúdo de material).
- [ ] **Step 5:** Rodar o teste de contrato, os testes de rota/sessão existentes, `typecheck` e `brain-check`. Verificar no preview local que a página responde em 320 px e 1440 px sem overflow horizontal.
- [ ] **Step 6:** Commit `feat(public): pagina de catalogo com busca e filtros`.

### Task 3: Prerender, canonical e sitemap do catálogo

**Files:**
- Modify: `scripts/public-material-data.mjs` (expor também os itens do catálogo para o prerender)
- Modify: `scripts/prerender-public-materials.mjs` (prerenderizar também `/{locale}/materiais`)
- Modify: `scripts/prepare-seo-sitemaps.mjs` (incluir o catálogo no sitemap de materiais)
- Modify: `scripts/validate-public-learning-resource-prerender.mjs` ou criar validador equivalente do catálogo
- Modify: `package.json` apenas se um novo script for realmente necessário

**Interfaces:**
- Consumes: o pipeline de prerender e sitemap já existente dos materiais curados e a RPC do Task 1.
- Produces: HTML estático em `/{locale}/materiais` com `<h1>` real, listagem crawlable do que estiver aprovado e `<link rel="canonical" href="https://www.apeeducation.org/{locale}/materiais">`; segmento correspondente no sitemap de materiais; e um validador que falha se a página perder H1, canonical ou a listagem.

- [ ] **Step 1:** Escrever/estender o validador para exigir, no HTML prerenderizado: `<h1>`, exatamente **1** `rel="canonical"`, ausência de `noindex` na URL base e presença dos itens aprovados (0 itens é aceitável, mas então a página precisa trazer o estado vazio no HTML). Rodar e ver falhar.
- [ ] **Step 2:** Estender o pipeline de prerender/sitemap até o validador ficar verde, sem duplicar lógica de fetch: o catálogo e os materiais devem sair do mesmo carregamento de dados.
- [ ] **Step 3:** Confirmar que URL com `?q=` ou filtro **não** entra no sitemap e recebe `noindex, follow` com canonical para a base.
- [ ] **Step 4:** Rodar `node scripts/brain-check.mjs`, `npm run build` e confirmar `seo:visibility:score` = 100 e o segmento novo no sitemap.
- [ ] **Step 5:** Commit `feat(seo): prerenderizar e publicar sitemap do catalogo curado`.

### Task 4: Evidência final e Segundo Cérebro

**Files:**
- Create: `reports/public-catalog/2026-09-13-public-catalog.md`
- Modify: `docs/brain/01-CURRENT-STATE.md`
- Create/Modify: nota de área correspondente em `docs/brain/areas/`

**Interfaces:**
- Consumes: tudo que as tasks 1-3 produziram e a evidência real coletada (consultas no banco de produção, HTML prerenderizado, screenshots).
- Produces: relatório com o que mudou, comandos executados com resultado, evidência do banco real, o que continua pendente (aprovação humana dos 5 rascunhos, catálogo vazio até então) e os próximos passos da Fase 5.

- [ ] **Step 1:** Coletar evidência real: consulta de produção mostrando contagens por `status`/`is_indexable`, HTML prerenderizado do catálogo, e screenshots mobile (390 px) e desktop (1440 px).
- [ ] **Step 2:** Escrever o relatório com comandos e saídas literais, incluindo rollback por commit e por migration.
- [ ] **Step 3:** Atualizar o Segundo Cérebro (`docs/brain/01-CURRENT-STATE.md` + nota de área) registrando a arquitetura do catálogo, a assinatura da RPC, o gate de indexação e a pendência de aprovação humana. Conectar com `[[wikilinks]]` existentes, sem criar nota órfã.
- [ ] **Step 4:** Rodar os gates do fechamento: suíte completa, `eslint .`, `npm run build`, `node scripts/brain-check.mjs`, `node scripts/preview-smoke.mjs`. Registrar saídas.
- [ ] **Step 5:** Commit `docs(brain): registrar catalogo publico e pendencias da fase 4`.

## Rollback

Reverter os commits desta branch em ordem inversa. No banco, o rollback da migration é o bloco escrito em `20260913180000_public_resource_catalog_v1.sql` (recriar a assinatura antiga `(text, integer, integer)` a partir do backup registrado e restaurar `grant`/`revoke`). Nenhum dado de curadoria é perdido por esse rollback: `public_resource_editorial` não é alterada por esta branch.

## Release gate

Não declarar a Fase 4 concluída, nem mesclar/publicar, antes de: (1) todos os gates verdes com saída fresca; (2) Segundo Cérebro atualizado; (3) a pendência de aprovação humana dos rascunhos registrada explicitamente como bloqueio de conteúdo público; (4) revisão final da branch inteira aprovada.

