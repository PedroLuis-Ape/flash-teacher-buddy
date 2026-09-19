# Internacionalização Tier 1 e SEO localizado — Implementation Plan

> **For agentic workers:** Execute inline in this worktree unless a later task explicitly authorizes delegation. Each task has its own focused verification.

**Goal:** Completar o suporte de interface em alemão e publicar versões editoriais coerentes em pt-BR, en, es, fr, it e de, preservando URLs existentes e mantendo JA/ZH/KO somente no Study.

**Architecture:** O registry de interface (`src/i18n/languages.ts`) continuará separado do registry de idiomas estudados (`src/features/study/lib/languages.ts`). O conteúdo público será dirigido por um registro único de páginas localizado, consumido pela rota React, pelo JSON-LD, pelo prerender e pelo sitemap; cada locale terá texto visível próprio, canonical própria, alternates somente para páginas existentes e um único x-default.

**Tech Stack:** React, TypeScript, i18next, React Router, JSON editorial versionado, Vite, scripts Node de prerender/SEO, Vitest.

**Spec:** `C:\Users\pedro\.codex\attachments\10c78faa-cad5-4138-aaac-da3da91e0dd4\Texto colado.txt`

## Global Constraints

- Tier 1 completo: pt-BR, en, es, fr, it e de.
- Tier 2 no Study: ja, zh-CN e ko; não criar SEO/UI público para esses idiomas.
- Preservar a separação entre locale da interface, idioma do conteúdo estudado, TTS e SEO.
- Não usar tradução automática em runtime e não publicar hreflang para página inexistente.
- Não destruir URLs existentes; PT/EN atuais continuam canônicos e acessíveis.
- Não criar migration, alterar Supabase ou modificar o MCP nesta tarefa.
- O texto localizado precisa estar visível no HTML e ser a mesma fonte usada no JSON-LD.

---

### Task 1: Registro e catálogo de interface alemã

**Files:**
- Modify: `src/i18n/languages.ts`
- Modify: `src/i18n/index.ts`
- Create: `src/i18n/resources/de/*.json` para os 11 namespaces existentes
- Modify: `scripts/validate-i18n-keys.mjs`
- Test: `src/i18n/__tests__/catalogParity.test.ts`, `src/i18n/__tests__/localePrecedence.test.ts`

- [ ] Adicionar `de`/`de-DE` ao registro de locale, aliases, persistência e `Intl`.
- [ ] Adicionar os 11 namespaces alemães com as mesmas chaves e placeholders dos 595 campos canônicos, traduzindo UI fixa e mantendo intactos valores de conteúdo do usuário.
- [ ] Montar o catálogo alemão no mesmo `catalogs` do i18next; nenhum segundo sistema de tradução.
- [ ] Fazer o validador de paridade usar `APP_LOCALES`/lista canônica de arquivos, incluindo DE e mantendo erro para chave ausente, extra, placeholder divergente ou plural incompleto.
- [ ] Validar locale explícito, armazenamento, navegador, `html lang` e locale Intl `de-DE`.

### Task 2: Registro único de páginas editoriais localizadas

**Files:**
- Create: `config/editorial/international-pages.json`
- Modify: `src/content/public/editorialMaster.ts`
- Modify: `src/components/seo/EditorialPage.tsx`
- Modify: `src/components/seo/editorialStructuredData.ts`
- Test: `src/components/seo/editorialMaster.contract.test.ts`, `src/components/seo/methodologyEvidenceSeo.test.ts`, `src/components/seo/officialSourceSeo.test.ts`

- [ ] Representar cada página editorial pública nos seis locales com `path`, `locale`, `title`, `description`, `h1`, `intro`, sections, links, CTA, FAQ, autoria e datas.
- [ ] Manter a tabela de rotas existentes PT/EN e acrescentar somente `/es`, `/fr`, `/it`, `/de` e seus equivalentes editoriais.
- [ ] Derivar `getPairedEditorialRoute`, labels, `Intl.DateTimeFormat`, CTA e textos estruturais do locale, sem condicionais binários PT/EN.
- [ ] Gerar JSON-LD com `inLanguage`, `url`, `headline`, `description` e breadcrumbs idênticos ao conteúdo visível.
- [ ] Garantir alternates recíprocos para as seis páginas equivalentes e `x-default` único apontando para `/`.

### Task 3: Rotas, metadata, sitemap e prerender

**Files:**
- Modify: `src/App.tsx`
- Modify: `config/public-seo-pages-international.json`
- Modify: `config/public-seo-official-sources.json`
- Modify: `config/public-seo-methodology-evidence.json`
- Modify: `scripts/prerender-international-pages.mjs`
- Modify: `scripts/validate-international-seo.mjs`
- Modify: `scripts/prepare-seo-sitemaps.mjs`
- Modify: `public/sitemap.xml`
- Tests: `scripts/*.test.mjs`, `src/components/seo/*.test.ts`

- [ ] Fazer as rotas localizadas apontarem para o mesmo componente editorial configurado.
- [ ] Alimentar prerender, canonical, hreflang, `og:locale`, `html lang`, JSON-LD e sitemap pelo registro único, sem listas duplicadas por idioma.
- [ ] Emitir somente páginas existentes dos seis idiomas Tier 1; não emitir JA/ZH/KO.
- [ ] Validar reciprocidade de alternates, ausência de duplicatas, x-default único por conjunto, canonical estável e URLs legadas preservadas.

### Task 4: QA e fechamento

**Files:**
- Modify: `docs/brain/areas/study-runtime.md` somente com estado durável final
- Test: locale, catalog parity, SEO contracts, `brain:check`, typecheck, lint, build e score SEO

- [ ] Rodar matriz de locale/HTML lang/Intl, Study labels/BCP-47/TTS para DE e JA/ZH/KO, e contratos de SEO.
- [ ] Rodar typecheck, testes, lint, build, validação internacional, sitemap e `brain:check`.
- [ ] Confirmar que `supabase/functions/mcp/index.ts` não foi modificado pelo build; se o pipeline o reescrever, restaurar o artefato gerado antes do commit.
- [ ] Só declarar Tier 1 completo se UI, Study, TTS, Import, SEO, hreflang, sitemap e prerender tiverem evidência verde.
