---
cssclasses:
  - ape-ai-note
type: program
status: active
area: public-activation
last_reviewed: 2026-09-13
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[03-ARCHITECTURE]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[24-SECURITY-AUDIT-2026-09-12]]"
---

# Programa de descoberta, ativação e identidade visual

## Objetivo

Transformar o APE em superfície pública de aprendizagem: Home que ativa em
segundos, atividade pública real jogável sem cadastro, materiais públicos
citáveis e identidade cromática própria. Entrega em PRs pequenos, um por
mudança principal, nunca em `main`.

## Decisões travadas (2026-09-13)

- Cor: direção A — base escura com accents vivos; nova paleta vira padrão e
  `classic`/`fresh`/`ocean` continuam disponíveis.
- URL canônica dos materiais: `/{locale}/material/{slug}`; `/portal/list/{id}`
  segue válido e apontará canonical para a página de slug.
- Escala global: rotas públicas e páginas de material dirigidas por um registro
  único de locales (pt-BR, en, es, fr, it); `hreflang` só quando houver tradução.
- Curadoria: o agente rascunha resumo/nível/tema a partir dos cards reais; nada é
  publicado sem aprovação.
- Guest → conta: aviso único; sem resposta o dispositivo vence; depois o remoto
  é autoritativo.
- Medição: eventos first-party com lista fechada e sem dado pessoal.

## Arquitetura entregue no ciclo 1

- Destaque da Home lido do banco: `app_config.featured_public_resource`
  (`{ list_id, order }`) + RPC `get_featured_public_resource_v1(_locale)`,
  `SECURITY DEFINER`, `search_path` fixo, `GRANT` para `anon, authenticated,
  service_role`.
- A RPC valida elegibilidade com a mesma regra do portal
  (`folders.visibility='class'`, `class_id IS NULL`, dono com
  `public_access_enabled`, título fora de `[Atribuição]%`), devolve 3 amostras
  reais e `play_path`. **Fallback honesto**: config inválida → recurso público
  elegível mais recente; sem recurso → `source: 'none'` e a seção não renderiza.
  Nunca inventa conteúdo.
- Home (`LandingHome`): CTA primária "Jogar agora — sem cadastro" (destino =
  `play_path` do servidor), secundária "Explorar materiais", terciária "Sou
  professor", microcopy de progresso local + seção de destaque + carrossel.
- Carrossel manual (sem autoplay): 4 screenshots reais do produto público em
  `public/marketing/screenshots/*.webp`, com `width`/`height`, `alt` e legenda em
  HTML; regeneração por `scripts/marketing-screenshots.mjs`.
- i18n: chaves `publicLanding.*` nas 5 locales, com teste de paridade.

## Causas-raiz encontradas (P0 de produto)

- [CORRIGIDO] As rotas públicas de estudo (`/portal/list/:id/study|mixed-study`
  e `/portal/collection/:id/...`) renderizavam `Study`/`MixedStudy` sem
  `InstitutionProvider`, que só existe no shell privado. Resultado:
  `useInstitution must be used within InstitutionProvider` → RouteErrorBoundary
  para qualquer visitante. **O visitante não conseguia jogar.** Corrigido
  envolvendo as quatro rotas; contrato de regressão em
  `src/features/public-home/publicActivation.contract.test.ts`.
- [ABERTO] A página de material `/portal/list/:id` mostra "Lista pública
  indisponível": as RPCs `get_public_learning_list` e
  `get_public_learning_list_card_preview` **existem no repositório mas não no
  banco de produção** (definidas em
  `supabase/migrations/20260713152000_public_learning_list_pages.sql`). Bloqueia
  a Fase 4.
- [ABERTO] No estudo público o glossário retorna 401 (rota pública usando
  cliente autenticado); a tela degrada com aviso e continua jogável.

## Evidência do ciclo 1

- Baseline (antes): typecheck 0 · 261 arquivos / 1605 testes · lint 0 erros / 72
  avisos · build com 23 rotas prerenderizadas · SEO 100/100 · preview smoke PASS.
- Depois: typecheck 0 · **262 arquivos / 1613 testes** · lint 0 erros / 72 avisos
  · build completo OK · **SEO 100/100** · preview smoke PASS (gate
  `supabase-unavailable` agora também exige o CTA principal visível).
- QA real em browser (390 px): destaque `source=config`, título real, CTA
  "Jogar agora — sem cadastro", carrossel com 4 slides; sem overflow horizontal
  em 320/360/375/390/430.
- Fluxo do visitante testado ponta a ponta: catálogo → pasta → hub de jogos →
  `mixed-study` renderizando o card real ("Eles estão cansados").

## Pendências e próximo passo real

- Fase 2 (identidade cromática), Fase 3 (guest/merge), Fase 4 (páginas de
  material + catálogo + i18n), Fase 5 (GEO + medição) seguem abertas.
- Prioridade antes da Fase 4: aplicar as migrations de páginas de material no
  banco de produção, porque a superfície de aquisição depende delas.

Related: [[01-CURRENT-STATE]] · [[08-RISKS]] · [[24-SECURITY-AUDIT-2026-09-12]] · [[10-CONTEXT-FEEDING-RULE]]
