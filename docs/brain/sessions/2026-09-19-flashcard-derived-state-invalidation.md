---
cssclasses:
  - ape-ai-note
type: session
status: active
area: supabase-runtime
last_reviewed: 2026-09-19
related:
  - "[[06-BUGS]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[areas/supabase-runtime]]"
  - "[[learning/lessons/2026-09-19-flashcard-derived-state-soft-delete]]"
---

# Invalidação de estado derivado do flashcard — 2026-09-19

## Objetivo

Estado derivado do card (favoritos, Lista Vermelha, Pontos de atenção,
Reforço, progresso por card e retomada) não pode continuar válido depois que o
card de origem deixa de existir. Novos cards são novas entidades, mesmo com
texto idêntico.

## Causa raiz — FATO CONFIRMADO

- Flashcards usam **soft delete** (`flashcards.deleted_at`). As FKs
  `ON DELETE CASCADE` de `user_red_list`, `user_special_flashcards`,
  `user_reinforcement_points` e `flashcard_progress` só disparam em DELETE
  físico, portanto não limpam nada no fluxo normal de exclusão.
- `user_favorites` foi reescrita como tabela genérica
  (`resource_type`/`resource_id`) e perdeu a FK para flashcards. Nada limpava o
  favorito quando o card era removido em definitivo.
- Leituras globais não revalidavam o card: `useFavorites` (sem escopo),
  `useRedList` (sem escopo) e `useSpecialFlashcards*` devolviam ids/contagens de
  cards mortos. O RPC escopado (`get_scoped_flashcard_favorites`) já filtrava
  `deleted_at IS NULL`; o caminho global não.

## Correção aplicada

- **Autoridade de leitura:** nova regra única em
  `src/features/cards/lib/liveFlashcardIds.ts` — um id só é referência válida
  se existe e está vivo. Aplicada em `useFavorites`, `useRedList`,
  `useSpecialFlashcards` (ids, contagem e detalhes) e `useReinforcement`.
- **Contagem de Pontos de atenção:** derivada das mesmas referências vivas da
  lista, nunca de linhas ativas cruas.
- **Revisar cards:** `useFlashcardReviewFlags` (ids e detalhes) filtra a fila
  pelos cards vivos; a fila não é identidade de grupo, é o card exato.
- **Retomada:** `useLatestStudyResume` só oferece 'voltar para onde parou' se a
  lista ainda tem pelo menos um card vivo.
- **Persistência:** migration
  `supabase/migrations/20260919120000_flashcard_derived_state_invalidation_v1.sql`
  com `prune_my_orphan_flashcard_derived_state_v1()` e trigger que limpa
  favoritos no DELETE físico de flashcard.
- **Invalidação imediata:** `src/features/cards/lib/derivedStateInvalidation.ts`
  centraliza a invalidação dos prefixos de cache dependentes e é chamada na
  exclusão simples, no bulk delete, ao desfazer e na lixeira.

## Decisão vigente — soft delete não destrói estado

O delete para a lixeira **não** apaga estado derivado: o 'Desfazer' dura 2
minutos e depende dele. A invalidação de card soft-deleted acontece na leitura
(filtro `deleted_at IS NULL`) e o pruning só remove referências cujo card não
existe mais em `public.flashcards`.

## Revision de conteúdo — não criar

Avaliado e descartado como mecanismo novo: o equivalente já existe.
`restoreStudySession` revalida a fila persistida contra os ids elegíveis,
descarta ids mortos e reindexa a sessão. `useLibraryChangeRevision` cobre o
recarregamento de agregados. Criar `content_revision` seria segunda fonte de
verdade para o mesmo invariante.

## Validação

- `pnpm typecheck` → exit 0.
- `pnpm test` → 348 arquivos, 2261 testes, todos passando.
  `pnpm build` → orçamento de bundle aprovado e SEO 100/100.
  `pnpm brain:check` → PASS.
- `eslint` nos arquivos alterados → 0 erros (2 avisos pré-existentes de
  `react-hooks/exhaustive-deps` em `ListDetail.tsx`).
- Regressão nova: `src/features/cards/lib/__tests__/derivedStateInvalidation.test.ts`
  (24 testes) cobrindo favorito, Lista Vermelha, atenção, contagem, Reforço,
  retomada, restore de sessão, migration e invalidação de cache.

## Sincronização com o remoto

O checkout `APP PITECO` estava 259 commits atrás de `origin/main` e carregava
alterações locais mais antigas que o remoto em `AGENTS.md`,
`docs/brain/04-DECISIONS.md`, `docs/brain/05-AGENTS.md` e
`supabase/functions/mcp/index.ts` — este último 8 mil linhas menor que o bundle
versionado. Esse estado foi preservado integralmente na branch local
`backup/local-main-20260919` antes de qualquer sincronização, e a `main` foi
atualizada por fast-forward. Nenhuma dessas versões antigas foi levada adiante.

Regra prática: não reaproveitar o checkout local como base sem conferir
`git status` e `git rev-list --count HEAD..origin/main`.

## Pendência material

- A migration **não foi aplicada em produção**. O conector Supabase desta
  sessão não tem permissão no projeto de dados `ymahldldyxvwjeruaxpr`, e
  `xrnfhhoxmmstagmelvyi` não possui o schema (`user_favorites`,
  `user_special_flashcards`, `user_reinforcement_points` e `user_red_list`
  não existem lá), portanto não serve para validar ou aplicar esta migration.
- Enquanto ela não for aplicada, a filtragem de leitura já corrige o
  comportamento visível; o pruning de órfãos reais só passa a existir depois.

## Próximo passo

Aplicar a migration em `ymahldldyxvwjeruaxpr` após liberar acesso no conector,
rodar o roteiro da seção 24 (100 cards → favoritos + Red List + Reforço +
progresso → Delete All → reimportar) e confirmar zero herança entre ids.

Related: [[06-BUGS]] · [[07-TESTS]] · [[08-RISKS]] · [[areas/supabase-runtime]]
