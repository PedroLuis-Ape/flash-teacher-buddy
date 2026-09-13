---
cssclasses:
  - ape-ai-note
type: current-state
status: active
area: visual-polish
related:
  - "[[10-CONTEXT-FEEDING-RULE]]"
  - "[[areas/visual-polish]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[09-ASTRA-HANDOFF]]"
  - "[[25-PUBLIC-ACTIVATION-PROGRAM]]"
  - "[[12-PROCESS-LOG-2026-09-11]]"
  - "[[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]]"
  - "[[README]]"
  - "[[learning/00-LEARNING-HUB]]"
  - "[[areas/adaptive-learning]]"
---

# Current State

## Data do checkpoint

2026-09-10 — retomada após interrupção do Computer Use.

2026-09-11 — cérebro operacional atualizado com `App-Piteco-Brain.zip`; conteúdo integral preservado em `imports/2026-09-11/App-Piteco-Brain/` e notas importadas marcadas em vermelho.

2026-09-11 — auditoria visual concluída com matriz CSS exata; a sessão de estudo foi conferida em mobile e desktop, sem overflow horizontal.

## Fase atual

Integração local de fechamento do programa Descobrir/Ativar: Home de ativação,
identidade cromática, continuidade visitante, materiais + catálogo curado e
GEO + medição estão reunidos na branch
`integration/ape-program-20260913`. A publicação continua sendo decisão do
Pedro.

[HISTORICO] O checkpoint anterior era de polimento visual responsivo e mantinha
as áreas de negócio fora do escopo; esse limite não vale para o programa atual.

## [HISTORICO] Governança operacional — 2026-09-11

- As Skills oficiais `piteco-second-brain-protocol` e
  `piteco-adaptive-learning-loop` foram instaladas em
  `C:\Users\pedro\.codex\skills\` e exigidas pelo `AGENTS.md`.
- O vault existente foi migrado sem apagar a origem para `docs/brain/`, com
  `.obsidian`, Properties, wikilinks e histórico preservados.
- O learning hub e o checker passaram: 34 notas ativas, 192 wikilinks e
  `BRAIN_CHECK_PASS`. [HISTORICO] A integração inicial estava na branch
  `codex/piteco-memory-skills-20260911`, commit `4966a6ef`; esse estado foi
  substituído pela integração atual abaixo.
- O contrato de ambientes Supabase foi revisado contra o código atual e está
  documentado em [[areas/supabase-runtime]]. O core usa o backend de dados
  `ymahldldyxvwjeruaxpr`; consumidores auxiliares que leem variáveis de
  ambiente diretamente ficaram como `[REVALIDATE]`.
- A especificação de motion/hover foi registrada em [[areas/motion-system]],
  foi aprovada e a primeira fatia do Games Hub foi implementada; a expansão
  para outras superfícies aguarda revisão visual autenticada.

## Worktree autoritativo — histórico da etapa visual

- Repositório: `C:\Users\pedro\Documents\APP PITECO`
- Worktree isolado de implementação: `C:\Users\pedro\AppData\Local\Temp\ape-mobile-visual-20260910`
- Branch do worktree isolado: `fix/mobile-visual-audit-20260910`
- Worktree de integração: `C:\Users\pedro\AppData\Local\Temp\ape-main-integration-20260911`, branch `main`, apontando para `ddc6f89a`.
- Branch visual contém `1fb8186c` (handoff Lovable), `61784295` (limitação de acesso Lovable), `6e67bdcd` (relatório), `ef9b1148`, `1d2b4e02`, `007709f7`, `bb2c7e15`, `b3f0cfc1`, `8181c66e`, `cc6ccc45`, `75479f4c`, `a3782283`, `a6f2c151` e `4f1c2346`.

## Worktree da integração atual — 2026-09-13

- [FATO CONFIRMADO] Worktree: `C:\Users\pedro\Documents\App-Piteco-Worktrees\ape-discovery-activation-20260913`.
- [FATO CONFIRMADO] Branch: `integration/ape-program-20260913`; HEAD:
  `0298f10f`.
- [DECISAO VIGENTE] Esta branch é local: não foi pushada, mesclada nem
  publicada na Lovable. Publicar ou integrar é decisão do Pedro.

## Concluído

- `4f1c2346` — otimização inicial dos layouts móveis de estudo.
- `a3782283` — primitivas compartilhadas de shell responsivo.
- `75479f4c` — hierarquia visual da Home, biblioteca e pastas.
- `cc6ccc45` — reserva de conteúdo para safe-area e teste de contrato fortalecido.
- Especificação e plano Superpowers em `docs/superpowers/specs/` e `docs/superpowers/plans/`.
- Auditorias estáticas de Home, navegação, biblioteca, turmas e overlays registradas em `docs/agent-orchestration/`.
- `8181c66e` — hierarquia visual do Hub de jogos, descrições semânticas e estados recomendado/configurado.
- `b3f0cfc1` — overlays compartilhados e detalhe de lista com limite dinâmico, scroll interno, safe-area e alvos de toque.
- `bb2c7e15` — feedback dos estudos e conclusão com estados explícitos, reduced-motion e ações acessíveis.
- `007709f7` — importação/exportação, ponto de atenção, ferramentas in-game, conclusão e camadas protegidos em mobile.
- `1d2b4e02` — Hub de jogos reserva espaço para a barra móvel e recomendação transitória não depende só de animação.
- `ef9b1148` — diálogos de pasta e edição de card com composição header/corpo/footer responsiva.
- Chrome conectado validado em `/dashboard`, `/folders`, `/reinforcement`, `/list/.../study` e `/list/.../games`; a sessão exibiu o controle in-game `No Reforço`.
- Relatório final da auditoria visual: `C:\Users\pedro\AppData\Local\Temp\ape-mobile-visual-20260910\docs\agent-orchestration\visual-release-report.md`.
- Segunda passada global validou rotas privadas, os seis modos de jogo, rotas públicas e 404 em viewport mobile; todas as rotas registraram `hasHOverflow: false` após carregamento.
- Passagem adicional em Chrome navegou nominalmente pelas 25 rotas editoriais públicas/portal/404; títulos e URLs finais corresponderam ao catálogo, com `/` redirecionando corretamente para `/dashboard`.
- Gates frescos em 2026-09-11: typecheck, 249 arquivos/1.542 testes, lint, build + SEO e preview smoke passaram; `61784295` registra a evidência final do Lovable e `6e67bdcd` registra o relatório completo.

## Limitações documentadas

- Importação do arquivo `App-Piteco-Brain.zip` registrada em [[11-ARCHIVE-IMPORT-2026-09-11]]; a cópia integral fica em `imports/2026-09-11/App-Piteco-Brain/`.
- O projeto Lovable foi aberto, mas o editor informou que ele é privado e a conta conectada `pedro55luizy@gmail.com` não tem acesso; nenhuma solicitação foi enviada. A referência visual usada foi o app publicado direto e o preview local.
- Depois que o usuário informou ter conectado a conta correta, a sessão CUA ainda listou somente o navegador interno; o Chrome autenticado não ficou acessível. O navegador interno repetiu `You don't have access`, então a comparação do preview segue pendente.
- A execução de agentes foi limitada pelo teto de threads; os relatórios existentes não equivalem à execução de todas as 30 funções.
- `npm`/`npx` não estão disponíveis no PowerShell desta máquina; os binários versionados em `node_modules` foram usados.
- O Chrome usa `devicePixelRatio=1.75`; a matriz foi calibrada multiplicando o viewport físico para obter exatamente o viewport CSS solicitado.

## [HISTORICO] Estado de release visual

Os gates técnicos e a matriz visual do escopo passaram. A branch `main` foi sincronizada com o `origin/main` divergente, resolvida no commit `ddc6f89a`, validada e enviada ao GitHub. Isso integra o polimento visual no repositório remoto, mas não publica automaticamente no Lovable. Ver [[07-TESTS]], [[08-RISKS]] e [[12-PROCESS-LOG-2026-09-11]].

## Arquivos críticos

`src/index.css`, `src/components/ape/ApeAppBar.tsx`, `src/components/ape/ApeTabBar.tsx`, `src/components/layout/PrivateShell.tsx`, `src/pages/Index.tsx`, `src/features/library/FoldersOptimized.tsx`, `src/pages/Folder.tsx`, `src/pages/ListDetail.tsx`, `src/pages/GamesHub.tsx`.

## Estado Git conhecido

O worktree isolado mantém uma alteração pré-existente em `supabase/functions/mcp/index.ts` e artefatos/documentos não relacionados. Não incluir essa alteração de Supabase nos commits visuais.

## Novo programa de auditoria — 2026-09-12

O usuário forneceu quatro frentes relacionadas: mobile-first, progressão
persistente, Reforço e retomada entre dispositivos. O preflight foi registrado
em [[12-PROCESS-LOG-2026-09-12]]. A fase mudou de polimento visual isolado para
auditoria arquitetural controlada; o texto histórico que dizia que persistência
e Supabase estavam fora do escopo agora está marcado como contexto anterior,
não como limite desta nova solicitação.

- [VERIFIED-REPO] Já existem `useEconomy`, `useReinforcement`,
  `useLatestStudyResume`, repository/outbox de sessões e migrations relacionadas.
- [REVALIDATE] A consulta autoritativa da Home ainda precisa ser alinhada com
  a consulta de retomada e com status/descartes reais de `study_sessions`.
- [UNKNOWN] Schema, RLS e RPCs efetivamente aplicados no Supabase de produção
  ainda não foram verificados nesta rodada.

## Estado da etapa Reforço — fechamento 2026-09-12

- A correção de layout da tela Reforço foi finalizada no commit `eea3261c`,
  integrada ao `main` e enviada ao GitHub (`c1769c3b..eea3261c`).
- Causa-raiz: o `Button` compartilhado aplica `w-full` abaixo de `sm`; ações
  icon-only sem largura intrínseca ocupavam a linha inteira e colapsavam o
  texto ao lado. Corrigido com `w-auto` em `src/pages/Reinforcement.tsx` e
  `src/pages/ListDetail.tsx`, protegido por dois contratos de regressão. Ver
  [[06-BUGS]] e [[07-TESTS]].
- A branch `fix/reinforcement-layout-20260912` ficou superada pela reescrita da
  tela no `main`; permanece apenas como histórico local.
- O contrato de dados segue inalterado: Pontos de atenção e Reforço não foram
  fundidos nesta etapa. Unificar continua sendo decisão de produto pendente.
- [VERIFIED-RUNTIME] A revisão `f522aea7` foi conferida no preview autenticado
  do Lovable em modo mobile (393 px): ações compactas de 48x44 px, título com
  252 px e nenhum overflow horizontal.

Related: [[12-PROCESS-LOG-2026-09-12]] · [[06-BUGS]] · [[07-TESTS]] · [[08-RISKS]] · [[areas/visual-polish]]

## Legibilidade mobile — 2026-09-12

- [VERIFIED-RUNTIME] Correção `3a836650` integrada ao `main`: nomes de lista e
  de turma deixam de ser cortados em telas estreitas. Ver [[06-BUGS]] e
  [[07-TESTS]].
- [PENDING] Confirmar esta revisão no preview autenticado quando o canal de
  inspeção voltar a responder.

Related: [[12-PROCESS-LOG-2026-09-12]] · [[06-BUGS]] · [[07-TESTS]] · [[08-RISKS]] · [[areas/visual-polish]]
## Limpeza de checkouts e worktrees — 2026-09-12

- [VERIFIED-GIT] 47 worktrees foram auditados e **45 removidos**; 33 estavam
  vazios (arquivos apagados do disco por limpadores) e 12 não tinham trabalho
  exclusivo.
- [VERIFIED-GIT] Nenhum commit ficou só local: a única branch com commits
  inéditos, `fix/reinforcement-layout-20260912`, foi enviada ao GitHub antes da
  remoção.
- [VERIFIED-GIT] O trabalho não commitado de `piteco-contextual` (18
  arquivos-fonte + 2 novos) foi preservado e movido para
  `C:\Users\pedro\Documents\App-Piteco-Worktrees\piteco-contextual`.
- [VERIFIED-GIT] Backups da limpeza ficam em
  `App-Piteco-Worktrees\_preservado\20260912\`, incluindo o patch de
  `supabase/functions/mcp/index.ts`.
- [VERIFIED-GIT] `C:\Users\pedro\Documents\APP PITECO` agora é o checkout
  principal na branch `main` (`0a06864a`), limpo. As alterações antigas ficaram
  em `git stash` (`preservado-pre-cleanup-20260912`).
- [VERIFIED-GIT] `AppData\Local\Temp` ficou sem nenhuma pasta `ape-*`.
- A regra permanente está em [[23-GIT-E-WORKTREES]].

Related: [[23-GIT-E-WORKTREES]] · [[12-PROCESS-LOG-2026-09-12]] · [[10-CONTEXT-FEEDING-RULE]]

## Auditoria de segurança — 2026-09-12

- [VERIFIED-REPO] A causa-raiz estrutural era `SECURITY DEFINER` confiando em
  identidade e preço vindos do cliente. Treze RPCs foram endurecidas no commit
  `90fb5144`, com contrato `16/16`, suíte `260` arquivos / `1601` testes,
  typecheck e build aprovados. Ver [[24-SECURITY-AUDIT-2026-09-12]].
- [VERIFIED-DB] Aplicado e verificado no **banco real** (editor SQL da Lovable):
  17 funções endurecidas, `anon` bloqueado em lixeira, compra, perfil, papéis
  e busca; versões `*_unsafe_v1` inalcançáveis; `purge_expired_trash` restrito;
  policy de listagem do bucket `skins` removida.
- [PENDING] Permanecem: deploy das Edge Functions `store-admin-*`, limpeza de
  IndexedDB no logout e unificação de identidade no `useAuthUser`.
- [RESOLVIDO] `public_profiles` não existe em produção; o redirect do
  `OAuthConsent` foi restringido a http(s) no commit `11b98663`; a superfície
  anon de `SECURITY DEFINER` caiu de 46 para 33 (todas públicas documentadas).
- [FUNCIONAL] `ensure_piteco_profile` não existe no banco de produção, embora
  `pitecoinBridge` e `economyData` a chamem — os caminhos de economia falham
  em runtime.

Related: [[24-SECURITY-AUDIT-2026-09-12]] · [[08-RISKS]] · [[07-TESTS]] · [[areas/supabase-runtime]]

## Materiais públicos — Fase 4, camada de dados (2026-09-13)

- [VERIFIED-DB] O banco de produção **não tem** `public_entity_publications`;
  portanto o registro moderno de publicação do repositório não existe lá. A
  Fase 4 **reutiliza a regra pública vigente do portal**
  (`folders.visibility='class'`, `class_id IS NULL`, dono com
  `public_access_enabled`) em vez de introduzir um segundo sistema de publicação.
- [DECISION] Curadoria editorial entra como camada adicional: tabela
  `public_resource_editorial` (list_id + locale, slug único, level, theme,
  resource_type, summary, `status` draft/approved/retired, `is_indexable`,
  revisão). RLS habilitada, sem policy, `REVOKE` de `public/anon/authenticated`
  — leitura apenas por RPC.
- [VERIFIED-DB] RPCs públicas `get_public_resource_v1(_locale, _slug)` e
  `list_public_resources_v1(_locale, _limit, _offset)`: `SECURITY DEFINER`,
  `search_path` fixo, `GRANT` para `anon`, e **quality gate** no servidor
  (≥ 8 cards e ≥ 90% de termos únicos) — material curto ou duplicado nunca
  publica.
- [VERIFIED-DB] Cinco sementes de curadoria aplicadas como **rascunho**
  (`status='draft'`, `is_indexable=false`), escritas a partir do conteúdo real
  dos cards. Verificado: rascunho não aparece (`source: none`, catálogo 0) e,
  com uma linha aprovada em teste, a RPC devolve `source: editorial` com 8
  amostras — depois revertida para rascunho. Nada ficou público.
- [DATA-QUALITY] Uma das listas públicas tem título "Passo 005 - Presente
  Interrogativo" com conteúdo de **passado** ("Were they in the classroom?") e
  duplica o título de outra lista — ficou fora das sementes até correção.
- [VERIFIED-TEST] Contrato `src/lib/__tests__/publicResourceEditorial.contract.test.ts`
  (6 testes): tabela/estados/deny-all, leitura só do aprovado, quality gate,
  reuso da regra vigente, grants e sementes apenas como rascunho.
- [NEXT] Fase 4 continua com a rota `/{locale}/material/{slug}` consumindo
  `get_public_resource_v1`, canonical/hreflang e inclusão no sitemap apenas para
  linhas aprovadas.

Related: [[07-TESTS]] · [[08-RISKS]] · [[areas/supabase-runtime]] · [[24-SECURITY-AUDIT-2026-09-12]]

## Materiais públicos — Fase 4, catálogo com busca e facetas (2026-09-13)

- [VERIFIED-DB] `list_public_resources_v1` substituiu a assinatura legada de
  três parâmetros pela assinatura
  `(_locale, _q, _level, _theme, _resource_type, _limit, _offset)`. O retorno
  agora é um objeto `{items, total, has_more, facets}`, não um array; as
  facetas `levels`, `themes` e `resource_types` são calculadas no conjunto
  aprovado/indexável elegível da locale, independentemente dos filtros atuais.
- [DECISION] Itens, contagem e facetas derivam da mesma elegibilidade pública:
  regra vigente do portal mais ≥8 cards ativos e ≥90% de termos únicos. Busca
  (`title`, `summary`, `theme`) e filtros exatos case-insensitive rodam na RPC;
  valores vazios não filtram. Isso não altera `status` nem `is_indexable`.
- [VERIFIED-DB] Smoke no banco real retornou `items: []`, `total: 0`,
  `has_more: false` e facetas vazias para `pt-BR`, resultado esperado enquanto
  não há curadoria aprovada/indexável. `pg_proc` confirmou uma única sobrecarga
  de sete parâmetros, com EXECUTE somente para `anon`, `authenticated` e
  `service_role`.
- [VERIFIED-REPO] `scripts/public-material-data.mjs` passou a consumir
  `data.items`, preservando seu comportamento de prerender/sitemap.

Related: [[07-TESTS]] · [[08-RISKS]] · [[areas/supabase-runtime]] · [[24-SECURITY-AUDIT-2026-09-12]]

## Materiais públicos — Fase 4, página de catálogo (2026-09-13)

- [VERIFIED-REPO] Rota pública `/:locale/materiais`, hook React Query próprio e
  catálogo com busca debounced, filtros no banco, três estados distintos
  (sem curadoria, zero filtrado e erro recuperável) e i18n nas cinco locales.
- [VERIFIED-REPO] O boundary da RPC valida estritamente raiz, itens, total,
  `has_more` e facetas; payload malformado lança erro recuperável, enquanto o
  vazio contratualmente válido permanece no estado sem curadoria.
- [VERIFIED-RUNTIME] Playwright consultou a RPC real, confirmou o payload vazio
  esperado, argumentos nulos/filtrados, retry, URL com `replace` e ausência de
  overflow em 320/360/375/390/430/1440 px. Mobile usa um único controle
  `Filtrar` expansível; a matriz também passou com os três selects abertos.
- [REVALIDATE] Cards reais não tiveram QA visual porque nenhuma curadoria está
  aprovada/indexável; não foi criado conteúdo fictício para contornar isso.
- [KNOWN-LIMIT] O shell cliente mantém seu canonical raiz estático ao lado do
  canonical correto emitido por `SEOHead`; filtros também emitem `noindex,
  follow`. Resolver o canonical global pertence ao pipeline SEO compartilhado.

Ver [[sessions/2026-09-13-public-catalog-task-2]], [[07-TESTS]] e [[08-RISKS]].

## Materiais públicos — Fase 4, prerender e sitemap (2026-09-13)

- [VERIFIED-REPO] Pipeline próprio do prerender: `scripts/public-material-data.mjs`
  lê `list_public_resources_v1` (só aprovado) e hidrata amostras por
  `get_public_resource_v1`; `scripts/prerender-public-materials.mjs` gera
  HTML inicial crawlable, canonical único e `sitemap-materials.xml`, e falha
  se faltar H1, canonical correto ou CTA.
- [VERIFIED-BUILD] Com uma linha aprovada em teste, o build gerou
  `dist/pt-br/material/verbo-to-be-presente-afirmativo/index.html` (14,8 KB)
  com **1 canonical** correto, H1 real, CTA e **8 amostras no HTML** — visível
  sem JavaScript. O `sitemap.xml` passou a listar `sitemap-materials.xml`.
  A linha foi revertida para rascunho em seguida.
- [DECISION] O canonical é reescrito no HTML (o shell carrega um canonical
  próprio), garantindo exatamente um por página pré-renderizada.

Related: [[07-TESTS]] · [[08-RISKS]] · [[areas/supabase-runtime]] · [[24-SECURITY-AUDIT-2026-09-12]]

## Materiais públicos — Fase 4, página canônica (2026-09-13)

- [VERIFIED-REPO] Rota `/:locale/material/:slug`, pública nos cinco locales, e
  `PublicResourcePage`, que só renderiza com `source === 'editorial'`; qualquer
  outro caso vira "Material não disponível" com `canonicalPath={null}`.
- [ROOT-CAUSE] `isAppLocale("pt-br")` é case-sensitive e devolvia falso, então a
  página caía no estado indisponível **sem sequer chamar a RPC**. Corrigido com
  `normalizeAppLocale` (URL em minúsculas → code i18n).
- [VERIFIED-RUNTIME] Em rascunho: "Material não disponível", sem amostras e sem
  CTA. Com uma linha aprovada (teste revertido em seguida): H1 real,
  `A1 · VERBO TO BE`, **8 amostras reais** dos cards e CTA "Jogar agora", sem
  overflow em 390 px; RPC respondendo 200.
- [DECISION] O canonical é montado do segmento da URL
  (`/pt-br/material/{slug}`), e não do code do locale, para canonical == URL.
- [PENDING] Antes de aprovar qualquer material: incluí-lo no pipeline de
  prerender/sitemap (que já existe para listas públicas). Sem isso a rota não
  tem HTML inicial e o shell emite um canonical próprio — canonical duplicado.

Related: [[07-TESTS]] · [[08-RISKS]] · [[areas/supabase-runtime]] · [[24-SECURITY-AUDIT-2026-09-12]]
## Catálogo público — pré-render, canonical e sitemap (2026-09-13)

- [VERIFIED-BUILD] `scripts/prerender-public-materials.mjs` agora pré-renderiza
  também as 5 páginas de catálogo (`/{locale}/materiais`) a partir do **mesmo**
  carregamento de dados dos materiais (`loadPublicMaterials` passou a devolver
  `catalogs`), e `sitemap-materials.xml` lista as 5 URLs base. Nenhuma URL com
  querystring entra no sitemap (validado no build).
- [VERIFIED-RUNTIME] `dist/pt-br/materiais/index.html`: **1 canonical**
  (`https://www.apeeducation.org/pt-br/materiais`), **1 meta robots** autoritativo
  (`index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1`),
  **1 H1** real e o estado vazio honesto ("Ainda não há materiais publicados
  neste idioma"), porque zero curadorias estão aprovadas.
- [ROOT-CAUSE] O `applyHead` compartilhado já removia o canonical estático do
  shell, mas **não** removia o `<meta name="robots">` de `index.html:74`. Toda
  página pré-renderizada saía com duas políticas de robots conflitantes.
  Corrigido no helper compartilhado, não em uma cópia do catálogo.
- [DECISION] O HTML pré-renderizado é a superfície autoritativa para crawlers:
  canonical e robots são reescritos no arquivo gerado, e
  `scripts/validate-public-material-prerender.mjs` quebra o build se houver
  ≠ 1 canonical, ≠ 1 robots, H1 ausente ou querystring no sitemap.
- [DECISION] `prerender-public-materials.mjs` passou a usar guarda
  `isDirectExecution`, para que importá-lo (pelo validador) não rode o prerender.
- [KNOWN-LIMIT] No SPA (sem prerender) o shell ainda mantém o canonical raiz
  estático ao lado do emitido por `SEOHead`. As rotas públicas de catálogo e
  material são pré-renderizadas; resolver o shell globalmente segue pendente.

Related: [[sessions/2026-09-13-public-catalog-task-3]] · [[07-TESTS]] · [[08-RISKS]] · [[23-GIT-E-WORKTREES]]
## Fechamento do bloco SEO/GEO do catálogo público (2026-09-13)

- [VERIFIED-BUILD] Suíte completa 266 arquivos / 1642 testes PASS; `eslint .`
  com 0 erros e 72 warnings pré-existentes; `npm run build` exit 0 com
  `seo:visibility:score` = 100/100 e orçamento de bundle aprovado;
  `brain:check` PASS (41 notas, 443 wikilinks).
- [VERIFIED-DB] A curadoria segue com 5 linhas em `draft` e
  `is_indexable = false`; a RPC pública responde `items: []`, `total: 0`.
  Isso é o estado correto, não uma falha.
- [PENDING] A revisão independente da Task 3 e a revisão final da branch
  inteira ficaram pendentes porque a conta atingiu o limite de uso de
  subagentes (liberação às 23:58 de 2026-09-12). Nenhuma task foi declarada
  concluída sem revisão: a Task 3 está implementada e rotulada REVALIDATE.
- [DECISION] A branch permanece **local e não mergeada** até as revisões
  rodarem; nada foi publicado na Lovable.
- [NEXT] Próximo passo planejado: **implementar o Modo Reino Beta público, com
  SEO, Guest Mode e uso exclusivo do modo misto gamificado**. Ver
  [[09-ASTRA-HANDOFF]] para o handoff completo e a primeira ação exigida.

Related: [[sessions/2026-09-13-public-catalog-task-3]] · [[09-ASTRA-HANDOFF]] · [[07-TESTS]]
## Fase 5 — GEO: dados estruturados e crawlers de assistentes (2026-09-13)

- [VERIFIED-BUILD] Material curado agora carrega JSON-LD no HTML pré-renderizado:
  `LearningResource` + `BreadcrumbList` (Portal → Materiais → material), gerados
  por `buildMaterialJsonLd` em `scripts/prerender-public-materials.mjs`.
- [DECISION] JSON-LD é emitido **só no pré-render**; o SPA não emite, para não
  duplicar blocos na mesma página.
- [VERIFIED-REPO] `public/robots.txt` ganhou bloco `OAI-SearchBot` liberando
  apenas `/{locale}/materiais` e `/{locale}/material/`.
- [VERIFIED-BUILD] IndexNow não exigiu código: o coletor já varre o
  `sitemap.xml` raiz e os sitemaps referenciados, incluindo
  `sitemap-materials.xml`.
- [PENDING] Nenhum material aprovado existe, então o JSON-LD do material está
  validado por fixture, não por página real.

Related: [[sessions/2026-09-13-ape-fase5-task1-geo]] · [[07-TESTS]] · [[08-RISKS]]
## Fase 5 — Medição: eventos first-party (2026-09-13)

- [VERIFIED-DB] `public.product_event` existe em produção com RLS habilitada,
  **zero policies** e sem SELECT/INSERT para `anon`. O cliente só escreve via
  `record_product_event_v1(text, jsonb, text, text)` (`SECURITY DEFINER`,
  `search_path = public`).
- [VERIFIED-DB] Allowlist fechada de 11 eventos e de chaves por evento: em teste
  real, `public_search_used` aceitou `{result_count, has_filters}` e **descartou**
  uma chave fora da lista antes do insert; nome inexistente devolveu
  `unknown_event` sem gravar nada.
- [DECISION] Throttle de 300 eventos por nome por minuto com limite global
  documentado — sem PII não há como identificar origem.
- [PENDING] Nenhum evento real de usuário foi coletado ainda; a instrumentação
  do cliente é a Task 3 da Fase 5.

Related: [[sessions/2026-09-13-ape-fase5-task2-eventos]] · [[07-TESTS]] · [[08-RISKS]]
## Programa de ativação pública — ciclo 1 (2026-09-13)

- [VERIFIED-REPO] Home pública agora exibe atividade real em destaque vinda do
  banco (`app_config.featured_public_resource` +
  `get_featured_public_resource_v1`), com CTA "Jogar agora — sem cadastro",
  carrossel de 4 screenshots reais e i18n nas 5 locales.
- [VERIFIED-RUNTIME] QA em browser: sem overflow em 320/360/375/390/430;
  visitante percorre catálogo → pasta → hub → estudo e o card renderiza.
- [FIX P0] Rotas públicas de estudo não montavam `InstitutionProvider` e
  quebravam para qualquer visitante; corrigido com contrato de regressão.
- [PENDING P0] `/portal/list/:id` continua indisponível em produção: as RPCs
  `get_public_learning_list*` existem no repositório e não no banco.
- Gates do ciclo: typecheck 0 · 262 arquivos / 1613 testes · lint 0 erros ·
  build completo OK · SEO 100/100 · preview smoke PASS.
- Ver [[25-PUBLIC-ACTIVATION-PROGRAM]].

Related: [[25-PUBLIC-ACTIVATION-PROGRAM]] · [[07-TESTS]] · [[08-RISKS]] · [[24-SECURITY-AUDIT-2026-09-12]]
## Identidade cromática — Fase 2 (2026-09-13)

- [VERIFIED-REPO] A paleta padrão `black` deixou o roxo: teal (primary), índigo
  (secondary), âmbar (accent) e neutros dessaturados.
- [ROOT-CAUSE] Os tokens estavam duplicados em `space-layouts.css` e a cópia
  vencia por especificidade; a duplicata foi removida e passou a existir uma
  única fonte (`space-ui-v1.css`), protegida por contrato.
- [VERIFIED-TEST] Contrato de contraste WCAG AA + banimento de classes roxas
  hardcoded em `src/`.
- Gates: typecheck 0 · 263 arquivos / 1628 testes · lint 0 erros · build OK ·
  SEO 100/100 · preview smoke PASS.
- Ver [[areas/visual-polish]].

Related: [[areas/visual-polish]] · [[07-TESTS]] · [[08-RISKS]] · [[24-SECURITY-AUDIT-2026-09-12]]
## Continuidade do visitante — Fase 3 (2026-09-13)

- [VERIFIED-REPO] O visitante já gravava preset e retomada no escopo `anon`
  (`authUserId || "anon"` em `Study.tsx` e no motor de estudo).
- [FIX] Ao entrar, esse estado ficava órfão: a conta não herdava nada. A ponte
  `src/features/guest/guestStateBridge.ts` copia chaves `studyPreferences:v4:anon:*`
  e `ape_state_study_resume:v2:anon` para o escopo do usuário, **sem sobrescrever**
  o que já existe na conta, e limpa o escopo `anon` para a pergunta não repetir.
- [DECISION] Pergunta única e não bloqueante (`GuestStateMergePrompt`, montado no
  shell autenticado): "usar deste dispositivo" ou "manter as da conta". Fechar
  sem responder aplica a política definida — o dispositivo vence; depois disso o
  remoto é autoritativo.
- [VERIFIED-REPO] Convite contextual não bloqueante
  (`GuestAccountInvite`) na página de material público: só aparece para visitante
  que já estudou neste dispositivo e é dispensável por sessão. O primeiro jogo
  nunca é interrompido.
- [VERIFIED-TEST] 8 testes no módulo (`guestStateBridge.test.ts` +
  `guestContinuity.contract.test.ts`): escopo correto, não sobrescrita, cópia de
  chaves novas, idempotência, descarte pela conta e decisão por usuário.
- Gates: typecheck 0 · 263 arquivos / 1613 testes · lint 0 erros · build OK ·
  SEO 100/100 · preview smoke PASS.

Related: [[07-TESTS]] · [[08-RISKS]] · [[24-SECURITY-AUDIT-2026-09-12]] · [[areas/supabase-runtime]]
## Fase 5 — Medição: instrumentação (2026-09-13)

- [VERIFIED-REPO] `src/lib/productEvents.ts` centraliza o envio: nunca lança,
  filtra o payload pela allowlist do servidor e ignora nome desconhecido sem
  chamar a RPC.
- [DECISION] `public_search_used` envia apenas `result_count` e `has_filters`;
  o termo digitado nunca sai do navegador.
- [VERIFIED-TEST] Os 11 eventos da allowlist estão instrumentados e cobertos por
  contrato (`productEventInstrumentation.contract.test.ts`), inclusive
  `guest_game_start`/`guest_game_complete`, que só disparam para visitante.
- [DECISION] O programa foi integrado numa única branch
  (`integration/ape-program-20260913`) porque as fases 1–3 estavam em branches
  paralelas nunca integradas.
- Suíte completa: 273 arquivos / 1693 testes PASS · typecheck 0 · build com
  SEO 100/100.

Related: [[sessions/2026-09-13-ape-fase5-task3-eventos-cliente]] · [[07-TESTS]] · [[08-RISKS]]

## Catálogo público — correções finais (2026-09-13)

- [CONFLITO corrigido] `canonical_path` saía com o code do locale (`/pt-BR/...`)
  enquanto rota, gate e prerender usam `/pt-br/...`; o primeiro material
  aprovado levaria visitante anônimo a página vazia. Corrigido nos dois RPCs
  (migration `20260913210000`, aplicada em produção) e blindado no gate de rota.
- [I18N corrigido] A copy do catálogo pré-renderizado vem agora do i18n real;
  antes os 4 locales não-pt-BR serviam texto em português no HTML.
- [DECISION] `noindex` de URL filtrada é runtime; o que protege a indexação é o
  canonical para a base e a ausência de URLs com filtro no sitemap.

Related: [[sessions/2026-09-13-catalogo-canonical-e-i18n]] · [[07-TESTS]] · [[08-RISKS]]

## Estado final consolidado — programa SEO/GEO e ativação — 2026-09-13

- [FATO CONFIRMADO] As cinco fases — Home de ativação, identidade cromática,
  continuidade visitante, materiais + catálogo curado e GEO + medição — estão
  integradas nesta branch. Os achados das revisões (autoria, allowlists/PII,
  tokens, throttle, backup, `has_filters`, locale, portão de ambiente,
  canonical e i18n) têm correções registradas nos commits `cf87e385`,
  `114df294`, `890ec291`, `1112091a` e `cc6e8f8a`.
- [FATO CONFIRMADO] As sessões registram typecheck sem erros, suíte final de
  276 arquivos/1709 testes, lint sem erros, build com SEO 100/100, validação
  de pré-render/canonical/robots/sitemap e QA browser mobile sem overflow;
  as verificações de banco confirmaram as RPCs e os contratos de medição.
- [DECISAO VIGENTE] As cinco curadorias continuam `draft` e
  `is_indexable=false`; não há conteúdo público aprovado, dado fictício ou
  publicação automática. JSON-LD só é emitido no pré-render; autoria só existe
  quando o payload fornece autor; eventos são first-party, allowlisted e sem
  PII.
- [NEEDS_RECONCILIATION] Permanecem a aprovação editorial e a revisão final/
  decisão de integração da branch, a ausência de tráfego real para validar a
  medição, a duplicidade do canonical no shell SPA e as limitações já ligadas
  em [[08-RISKS]] (incluindo `/portal/list/:id` e glossário público).
- [INFERENCIA] Sem aprovação editorial, QA visual de cards reais e validação
  do ramo JSON-LD sem autor continuam impossíveis; a fixture cobre apenas o
  contrato anônimo.

Próximo passo e ordem de retomada: [[09-ASTRA-HANDOFF]].

## Estudo — correção de orientação A/B, labels e TTS — 2026-09-13

- [FATO CONFIRMADO] A branch `integration/ape-program-20260913` contém o commit local `fix(study): orientacao efetiva de idioma/label/tts no estudo e no modo misto`.
- [FATO CONFIRMADO] O runtime agora usa settings centralizados no Mixed e orientação de deck somente por evidência agregada; não houve alteração de cards, banco, migration, merge, push ou deploy.
- [FATO CONFIRMADO] Gates: typecheck 0; Vitest 278 arquivos/1723 testes; ESLint 0 erros/72 warnings; build e SEO 100/100; brain-check PASS.
- [FOLLOW-UP] Permanecem a duplicidade de direção em `gameCore.ts`, recálculos nos wrappers e `PronunciationStudyView` fixado em `sideB`. Ver [[sessions/2026-09-13-ab-language-orientation]] e [[08-RISKS]].
## Verificação ao vivo do programa SEO/GEO (2026-09-13)

Verificado no preview servindo o build do `main` (`e52bf92b`):

- Fase 1: destaque real no DOM (`data-featured-source="config"`, Passo 001 · 33 cards · Pedro), CTA
  "Jogar agora — sem cadastro" e carrossel com os 4 screenshots; o CTA leva ao Hub de jogos (funciona).
- Fase 2: paleta `black` = teal `172 70% 50%`, índigo `232 60% 55%`, âmbar `38 92% 58%`, fundo `rgb(12,14,19)`.
- Fase 4: 5 locales com H1 próprio, 1 canonical, 1 robots e JSON-LD; busca funciona (`?q=` + estado filtrado
  + limpar filtros); `noindex, follow` com filtro; sitemap com 5 URLs sem querystring.
- Fase 5: `robots.txt` com OAI-SearchBot sem bloquear a raiz; JSON-LD nas páginas públicas.
- Bug A/B: na tela — English / "I am at home" / "Escolha a tradução em Português:" com opções em português.
- Mobile 390 px: catálogo e home sem overflow horizontal; toggle `Filtrar` presente no mobile.
- [PENDENTE] Lista pública indisponível — ver [[06-BUGS]] (decisão do Pedro).
- [OBSERVAÇÃO] `/{locale}/material/{slug}` não aprovado mostra "Material não disponível" mas não emite
  `noindex` (herda o `index,follow` estático do shell).
