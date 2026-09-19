---
cssclasses:
  - ape-ai-note
type: lesson
status: candidate
area: supabase-runtime
last_reviewed: 2026-09-19
related:
  - "[[areas/supabase-runtime]]"
  - "[[sessions/2026-09-19-flashcard-derived-state-invalidation]]"
  - "[[learning/LESSON-INDEX]]"
  - "[[06-BUGS]]"
---

# Soft delete de card não invalida estado derivado sozinho

## CANDIDATE_LESSON

Quando a entidade usa soft delete, `ON DELETE CASCADE` deixa de ser uma
garantia: o DELETE físico não acontece e nenhuma cascata dispara. Todo estado
que guarda o id da entidade (favoritos, listas de prioridade, filas,
materializações, progresso) passa a poder referenciar uma entidade morta.

A defesa precisa ser dupla: a leitura deve tratar 'existe' como 'existe e está
vivo' (filtro `deleted_at IS NULL` na autoridade, não só na UI), e o pruning de
órfãos reais deve existir para o caso de DELETE físico.

## Evidência

- `user_red_list`, `user_special_flashcards`, `user_reinforcement_points` e
  `flashcard_progress` têm FK com `ON DELETE CASCADE`, mas a exclusão no app
  apenas grava `flashcards.deleted_at`.
- `user_favorites` é genérica (`resource_type`/`resource_id`) e não tem FK; o
  favorito sobrevivia ao DELETE físico do card.
- Consultas globais devolviam ids e contagens de cards inexistentes; o RPC
  escopado equivalente já filtrava `deleted_at IS NULL`.

## Escopo

Aplica-se a qualquer tabela com soft delete consumida por features que guardam
o id. **Não** implica apagar estado derivado no soft delete: a lixeira tem
'Desfazer' e o estado precisa sobreviver ao restore. Também não substitui a
revalidação de filas persistidas no restore, que já descarta ids mortos.

## Anti-padrão relacionado

Confiar na FK para consistência lógica quando o domínio usa exclusão lógica, e
corrigir a aparência apenas escondendo o item na UI — o dado órfão continua
vivo e volta a aparecer em contagens, retomadas e caches frios.

Related: [[areas/supabase-runtime]] · [[06-BUGS]] · [[learning/LESSON-INDEX]]

