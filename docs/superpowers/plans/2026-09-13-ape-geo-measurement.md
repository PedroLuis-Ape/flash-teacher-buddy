# APE — GEO e Medição First-Party (Fase 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar as páginas públicas de material citáveis por buscadores e assistentes (dados estruturados fiéis ao HTML, crawlers liberados nas páginas elegíveis, IndexNow no ciclo de publicação) e medir a ativação com eventos first-party mínimos, sem PII e sem dependência de terceiros.

**Architecture:** Reaproveita `SEOHead` (que já aceita `robots`, `canonicalPath`, `path`, `alternates` e `jsonLd`) e os builders em `src/components/seo/`. Adiciona uma tabela de eventos insert-only com RPC de allowlist estrita e um helper de cliente que nunca lança. O pipeline de prerender/sitemap já existente continua sendo o único caminho de publicação.

**Tech Stack:** React 18, TypeScript, Vite, TanStack Query, Supabase/Postgres, Vitest, Playwright, Node 24.

**Spec:** O plano-mãe aprovado (Fase 5 do programa de descoberta/ativação). Onde os dois divergirem, vale o plano-mãe.

## Global Constraints

- Nunca trabalhar em `main`. Um commit lógico por step relevante.
- **JSON-LD fiel ao visível:** todo dado no `LearningResource`/`BreadcrumbList` precisa existir no HTML renderizado e no estado real da página (nada de inventar autor, nota, duração ou idioma).
- **Nenhum PII nos eventos.** Nem e-mail, nem nome, nem id de usuário, nem id de dispositivo, nem termo de busca em claro. A allowlist de nomes é fechada no servidor; payload fora da allowlist de campos é descartado, não gravado.
- **Eventos nunca quebram a experiência:** o helper de cliente engole falhas de rede (fire-and-forget), nunca bloqueia render, nunca aparece em testes como ruído e nunca é enviado em ambiente sem configuração.
- **`robots` só libera o que é elegível:** `OAI-SearchBot` e demais crawlers de assistentes ganham permissão **apenas** nas rotas públicas de material e catálogo; as rotas privadas continuam bloqueadas como hoje.
- **Reaproveitar `scripts/submit-indexnow.mjs`** em vez de criar um segundo submissor.
- **Segurança:** tabela de eventos com RLS deny-all e acesso apenas por RPC `SECURITY DEFINER` com `search_path` fixo; `REVOKE` de `public`; `GRANT` só de `execute`.
- **Banco de produção:** toda migration aplicada em produção (projeto `ymahldldyxvwjeruaxpr`) precisa de backup da definição anterior e bloco de rollback escrito no arquivo.
- **Ruído que nunca entra em commit:** `supabase/functions/mcp/index.ts`, `dependency-audit-report.json`, `security-audit-report.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tmp/`, `reports/seo-visibility/latest-eval.json`.
- **Gates por task:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json` = 0; testes focados verdes; `node scripts/brain-check.mjs` PASS. Fechamento: suíte completa, `eslint .` sem novos erros, `npm run build` com `seo:visibility:score` = 100, `node scripts/preview-smoke.mjs` PASS.

### Task 1: Dados estruturados, crawlers de assistentes e IndexNow

**Files:**
- Modify: `src/features/public-materials/PublicResourcePage.tsx`
- Modify: `src/components/seo/publicLearningResourceStructuredData.ts` (adicionar builder de `BreadcrumbList` se não existir)
- Modify: `public/robots.txt`
- Modify: `scripts/submit-indexnow.mjs` (incluir as URLs de material no ciclo de publicação, se ainda não incluir)
- Create: `src/components/seo/publicResourceStructuredData.test.ts`

**Interfaces:**
- Consumes: payload de `get_public_resource_v1` (level, theme, resource_type, summary, list.title, author_name, card_count, canonical_path, play_path) e o `SEOHead` já usado pela página.
- Produces: `jsonLd` com `LearningResource` (nome = título real, `inLanguage`, `learningResourceType`, `educationalLevel` quando existirem, `teaches`/`about` a partir do tema, `isAccessibleForFree: true`, `url` = canonical) + `BreadcrumbList` (home → catálogo → material) e um bloco em `public/robots.txt` liberando `OAI-SearchBot` explicitamente.
- Regra: se um campo não existe no payload, ele **não** entra no JSON-LD. Nada de valor inventado ou placeholder.

- [ ] **Step 1:** Escrever o teste que valida o JSON-LD contra o payload real de exemplo: campos presentes apenas quando a fonte existe, `url` igual ao canonical, breadcrumb com 3 níveis, e ausência de qualquer chave com valor nulo/undefined/vazio. Rodar e ver falhar.
- [ ] **Step 2:** Implementar os builders e plugar na página até o teste ficar verde.
- [ ] **Step 3:** Estender `public/robots.txt` com a liberação explícita dos crawlers de assistentes nas rotas públicas elegíveis, sem afrouxar nenhuma rota privada já bloqueada.
- [ ] **Step 4:** Garantir que o ciclo de publicação de material submete as URLs ao IndexNow (reaproveitando `scripts/submit-indexnow.mjs`), com teste do arquivo se ele ainda não tiver cobertura.
- [ ] **Step 5:** Rodar teste focado, `typecheck`, `node scripts/brain-check.mjs` e `npm run build` (o build já roda `seo:visibility:score`). Verificar no HTML prerenderizado que o JSON-LD aparece e que o `robots` da página de material não tem `noindex`.
- [ ] **Step 6:** Commit `feat(seo): dados estruturados e crawlers de assistentes nos materiais`.

### Task 2: Infraestrutura de eventos first-party no banco

**Files:**
- Create: `supabase/migrations/20260913200000_product_events_v1.sql`
- Create: `src/lib/__tests__/productEvents.contract.test.ts`
- Modify: `docs/brain/01-CURRENT-STATE.md`

**Interfaces:**
- Consumes: nada existente — hoje não há infraestrutura de analytics no repositório.
- Produces: tabela `public.product_event` (`id`, `name`, `payload jsonb`, `created_at`, `occurred_on date`, `locale text`, `surface text`) com RLS deny-all, e RPC `public.record_product_event_v1(_name text, _payload jsonb default '{}'::jsonb, _locale text default 'pt-BR', _surface text default null)` com:
  allowlist fechada dos 11 nomes (`featured_resource_impression`, `featured_resource_play`, `public_resource_view`, `public_search_used`, `guest_game_start`, `guest_game_complete`, `guest_resume`, `signup_sync_cta_view`, `signup_after_guest`, `carousel_slide_view`, `carousel_interaction`);
  allowlist de chaves por evento (ex.: `public_search_used` aceita apenas `result_count` e `has_filters`; nunca o termo digitado em claro);
  descarte silencioso de nome desconhecido (retorna jsonb informando `accepted: false`, sem erro que vaze allowlist);
  limite de payload (chaves e bytes) e throttle por janela curta para evitar flood.
- Rollback escrito no arquivo da migration.

- [ ] **Step 1:** Escrever o contrato que lê o SQL e afirma: nome da tabela, RLS habilitada, deny-all (`revoke all ... from public, anon, authenticated`), os 11 nomes presentes na allowlist, rejeição de nome desconhecido, presença do limite de payload, do throttle, `security definer`, `set search_path = public`, `grant execute` só da nova assinatura e o bloco de rollback. Rodar e ver falhar.
- [ ] **Step 2:** Criar a migration até o contrato ficar verde.
- [ ] **Step 3:** Aplicar em produção pelo conector Lovable (`project_id: b6f1ba83-b44c-4a41-8589-b1e5380cf1ea`) com backup registrado e verificar por consulta real: chamada com nome válido grava 1 linha; chamada com nome inválido não grava; payload com chave proibida não grava a chave.
- [ ] **Step 4:** Rodar o contrato, `node scripts/brain-check.mjs` e `typecheck`; atualizar `docs/brain/01-CURRENT-STATE.md`.
- [ ] **Step 5:** Commit `feat(analytics): eventos first-party com allowlist e throttle`.

### Task 3: Emissão de eventos nas superfícies públicas

**Files:**
- Create: `src/lib/productEvents.ts` (helper de cliente fire-and-forget, `trackProductEvent`)
- Create: `src/lib/__tests__/productEventsClient.test.ts`
- Modify: `src/features/public-home/FeaturedPublicResource.tsx` e `useFeaturedPublicResource.ts` (`featured_resource_impression`, `featured_resource_play`)
- Modify: `src/features/public-home/MarketingCarousel.tsx` (`carousel_slide_view`, `carousel_interaction`)
- Modify: `src/features/public-materials/PublicResourcePage.tsx` (`public_resource_view`)
- Modify: a página de catálogo do bloco anterior (`public_search_used`, apenas contagem e flag de filtro)

**Interfaces:**
- Consumes: RPC `record_product_event_v1` do Task 2 via `publicSupabase`.
- Produces: helper que nunca lança, não envia nada quando a RPC não existe (ambiente sem a migration) e impede duplicidade de impressão por montagem (uma vez por sessão de página).

- [ ] **Step 1:** Escrever o teste do helper: sucesso não lança, erro de rede não lança, payload com chave fora da allowlist é removido antes do envio, e impressão repetida só conta uma vez. Rodar e ver falhar.
- [ ] **Step 2:** Implementar o helper até o teste ficar verde.
- [ ] **Step 3:** Plugar os seis eventos das superfícies públicas, cada um com teste de contrato afirmando que o componente chama o helper no momento certo e com o payload certo.
- [ ] **Step 4:** Rodar testes focados, `typecheck` e `brain-check`.
- [ ] **Step 5:** Commit `feat(analytics): instrumentar superficies publicas de ativacao`.

### Task 4: Emissão de eventos no fluxo visitante → conta

**Files:**
- Modify: `src/features/guest/guestStateBridge.ts` (`guest_resume` quando há estado local retomável)
- Modify: `src/features/guest/GuestStateMergePrompt.tsx` (`signup_sync_cta_view`, `signup_after_guest`)
- Modify: `src/features/guest/GuestAccountInvite.tsx` (`signup_sync_cta_view`)
- Modify: o ponto de início/conclusão de jogo em modo visitante (`guest_game_start`, `guest_game_complete`)
- Create/modify: testes de contrato ao lado de cada arquivo tocado

**Interfaces:**
- Consumes: `trackProductEvent` do Task 3 e a ponte de estado `guestStateBridge`.
- Produces: os cinco eventos restantes da allowlist, todos sem identificar o visitante (nenhum id de dispositivo, nenhum progresso real, apenas contagem/booleans).

- [ ] **Step 1:** Escrever os contratos dos cinco eventos (momento certo, payload permitido, nada de PII). Rodar e ver falhar.
- [ ] **Step 2:** Plugar os eventos até os contratos ficarem verdes, sem alterar em nada a lógica de merge visitante→conta nem a ordem das perguntas.
- [ ] **Step 3:** Rodar testes focados do fluxo guest, `typecheck` e `brain-check`.
- [ ] **Step 4:** Commit `feat(analytics): instrumentar continuidade visitante e conversao`.

### Task 5: Evidência final e Segundo Cérebro

**Files:**
- Create: `reports/geo-analytics/2026-09-13-fase-5.md`
- Modify: `docs/brain/01-CURRENT-STATE.md` e nota de área correspondente

**Interfaces:**
- Consumes: tudo que as tasks 1-4 produziram e a evidência real (HTML prerenderizado, linhas gravadas em `product_event` no ambiente de produção, resultado do IndexNow).
- Produces: relatório com comandos e saídas literais, limitações (ex.: nenhum evento real de visitante em volume), decisões e próximos passos.

- [ ] **Step 1:** Coletar evidência real e higienizar os dados de teste gravados em produção (remover as linhas de verificação, se houver).
- [ ] **Step 2:** Escrever o relatório com evidência literal e rollback por commit/migration.
- [ ] **Step 3:** Atualizar o Segundo Cérebro conectando com `[[wikilinks]]` existentes.
- [ ] **Step 4:** Rodar todos os gates do fechamento e registrar as saídas.
- [ ] **Step 5:** Commit `docs(brain): registrar geo e medicao first-party da fase 5`.

## Rollback

Reverter os commits em ordem inversa. No banco, o rollback é o bloco escrito em `20260913200000_product_events_v1.sql` (`drop function` + `drop table public.product_event`). Como a tabela é insert-only e não tem FKs para tabelas de produto, o rollback não afeta nenhum dado do usuário.

## Release gate

Não declarar a Fase 5 concluída, nem mesclar/publicar, antes de: todos os gates verdes com saída fresca; Segundo Cérebro atualizado; nenhuma linha de evento de teste deixada em produção; JSON-LD conferido contra o HTML visível; e revisão final da branch inteira aprovada.

