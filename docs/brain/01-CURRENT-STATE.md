---
cssclasses:
  - ape-ai-note
type: current-state
status: merged
area: visual-polish
related:
  - "[[10-CONTEXT-FEEDING-RULE]]"
  - "[[areas/visual-polish]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
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

Polimento visual responsivo, mobile-first, do App Piteco. A lógica de negócio, Supabase, autenticação, progresso, sessões, importação e algoritmos de estudo estão fora do escopo.

## Governança operacional — 2026-09-11

- As Skills oficiais `piteco-second-brain-protocol` e
  `piteco-adaptive-learning-loop` foram instaladas em
  `C:\Users\pedro\.codex\skills\` e exigidas pelo `AGENTS.md`.
- O vault existente foi migrado sem apagar a origem para `docs/brain/`, com
  `.obsidian`, Properties, wikilinks e histórico preservados.
- O learning hub e o checker passaram: 34 notas ativas, 192 wikilinks e
  `BRAIN_CHECK_PASS`. Esta integração está na branch
  `codex/piteco-memory-skills-20260911`, commit `4966a6ef`; aguarda revisão do
  usuário e eventual merge.
- O contrato de ambientes Supabase foi revisado contra o código atual e está
  documentado em [[areas/supabase-runtime]]. O core usa o backend de dados
  `ymahldldyxvwjeruaxpr`; consumidores auxiliares que leem variáveis de
  ambiente diretamente ficaram como `[REVALIDATE]`.
- A especificação de motion/hover foi registrada em [[areas/motion-system]],
  foi aprovada e a primeira fatia do Games Hub foi implementada; a expansão
  para outras superfícies aguarda revisão visual autenticada.

## Worktree autoritativo

- Repositório: `C:\Users\pedro\Documents\APP PITECO`
- Worktree isolado de implementação: `C:\Users\pedro\AppData\Local\Temp\ape-mobile-visual-20260910`
- Branch do worktree isolado: `fix/mobile-visual-audit-20260910`
- Worktree de integração: `C:\Users\pedro\AppData\Local\Temp\ape-main-integration-20260911`, branch `main`, apontando para `ddc6f89a`.
- Branch visual contém `1fb8186c` (handoff Lovable), `61784295` (limitação de acesso Lovable), `6e67bdcd` (relatório), `ef9b1148`, `1d2b4e02`, `007709f7`, `bb2c7e15`, `b3f0cfc1`, `8181c66e`, `cc6ccc45`, `75479f4c`, `a3782283`, `a6f2c151` e `4f1c2346`.

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

## Estado de release visual

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
