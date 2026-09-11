---
cssclasses:
  - ape-ai-note
---

# Routes and Surfaces

## Entrada/autenticação
**[VERIFICADO-REPO]**
- `/`
- `/landing`
- `/dashboard`
- `/auth`
- `/auth/callback`
- `/.lovable/oauth/consent`

## SEO/editorial
- `/ingles-para-iniciantes`
- `/atividades-de-ingles`
- `/flashcards-de-ingles`
- `/para-professores`
- `/pt-br`, `/pt-br/recursos`, `/pt-br/flashcards`, `/pt-br/para-professores`, `/pt-br/sobre`
- `/pt-br/fonte-oficial`, `/pt-br/metodologia`, `/pt-br/evidencias`
- `/en`, `/en/features`, `/en/flashcards`, `/en/for-teachers`, `/en/about`
- `/en/official-source`, `/en/methodology`, `/en/evidence`

## Conteúdo/biblioteca
- `/folders`
- `/folder/:id`
- `/list/:id`
- `/collection/:id`
- `/glossary`
- `/term-check`
- `/search`
- `/trash`

## Jogos/estudo
- `/list/:id/games`
- `/list/:id/study`
- `/list/:id/mixed-study`
- `/collection/:id/games`
- `/collection/:id/study`
- `/collection/:id/mixed-study`

## Portal público
- `/portal`
- `/portal/professor/:slug`
- `/portal/folder/:id`
- `/portal/list/:id`
- `/portal/list/:id/games`
- `/portal/list/:id/study`
- `/portal/list/:id/mixed-study`
- `/portal/collection/:id`
- `/portal/collection/:id/study`
- `/portal/collection/:id/mixed-study`

## Professor/turmas
- `/turmas`
- `/turmas/professor`
- `/turmas/aluno`
- `/turmas/:turmaId`
- `/turmas/:turmaId/import/super`
- `/professor/alunos`
- `/professor/alunos/:alunoId`
- `/professores/:professorId`
- `/my-teachers`
- `/painel-professor`
- `/settings/public-profile`

## Outras superfícies
- `/profile`, `/about`
- `/notes`, `/notes/:id`
- `/goals`, `/goals/new`
- `/import`, `/import/super`
- `/reinforcement`
- `/store`, `/store/inventory`, `/store/exchange`
- `/gifts`
- `/reinos`, `/reino`, `/reino/:code`, `/reino/importar`
- `/admin/catalog`, `/admin/logs`, `/admin/gifts`
- `/settings/performance`, `/settings/shortcuts`
- `/audit`, `/special-cards`, `/system-status`, `/reportar-problema`

## Navegação
**[VERIFICADO-REPO — auditoria 09/09]**
- fallback sem histórico foi alinhado a `/dashboard`;
- swipe foi alinhado a `/dashboard`;
- barra final em `/study/` foi corrigida para não deixar navegação global sobre jogo.

**[REVALIDAR]** login privado/deeplink ainda tinha caminhos pendentes.

## Visitante público
**[HISTÓRICO/DECISÃO]**
Visitante pode consumir/jogar conteúdo público, mas não deve editar ou gravar progresso/pontos/sessões/favoritos no servidor. Revalidar implementação e RLS antes de mudanças.
