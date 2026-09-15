---
category: documentation
type: session-checkpoint
status: pending
area: study
date: 2026-09-15
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[areas/study-runtime]]"
  - "[[04-DECISIONS]]"
  - "[[08-RISKS]]"
---

# Plano — “Revisar cards / Revisar depois” (spec recebida, NÃO implementada)

## Status

- [FATO CONFIRMADO] A especificação completa foi recebida e o **baseline foi conferido**
  nesta rodada, mas a **implementação NÃO foi feita**. Esta nota existe para que a
  execução comece sem refazer discovery.
- [FATO CONFIRMADO] Motivo de não implementar na mesma sessão: a feature atravessa
  o runtime de estudo (6 modos + Mixed) e o runtime acabou de ser reformado e
  publicado em [[areas/study-runtime]]. Entrar pela metade ali é exatamente o
  risco que a spec pede para evitar.

## Baseline confirmado (sanity check, com evidência)

- [FATO CONFIRMADO] Todos os arquivos citados existem: `src/pages/Study.tsx`,
  `src/pages/MixedStudy.tsx`, `FlipStudyView(.impl).tsx`,
  `WriteStudyView.impl.tsx`, `MultipleChoiceStudyView(.impl).tsx`,
  `UnscrambleStudyView.impl.tsx`, `PronunciationStudyView.impl.tsx`,
  `MixedSlotActivity.tsx`, `EditFlashcardDialog.tsx`, `useAttentionPoint.ts`,
  `useSpecialFlashcards.ts`, `SpecialButton.tsx`, `SpecialCards.tsx` e
  `supabase/migrations/20260902090000_separate_attention_and_reinforcement.sql`.
- [FATO CONFIRMADO] Os modos já recebem props do domínio **Pontos de atenção**
  (`onToggleSpecial` aparece em 12 arquivos). A nova feature usa props próprias
  (`isReviewFlagged` / `reviewFlagPending` / `onToggleReviewFlag`) e **não renomeia**
  as existentes.
- [FATO CONFIRMADO] Rotas privadas ficam em `src/App.tsx`; a referência de padrão é
  a linha ~242 (`<Route path="/special-cards" element={<SpecialCards />} />`). A
  rota nova entra ali.
- [FATO CONFIRMADO] `EditFlashcardDialog` recebe `{ flashcard: { id, term,
  translation, hint, image_url_a, image_url_b, word_hints, list_id, user_id,
  parent_card_id } | null, isOpen, onClose }` — é reutilizável na tela de revisão
  desde que a tela busque o card ORIGINAL por id.

## Modelo de dados (aditivo, decidido)

- Tabela nova `public.user_flashcard_review_flags`: `id`, `user_id`,
  `flashcard_id` (FK `flashcards`), `source_group_uid` (só contexto),
  `source_list_id`, `institution_id`, `reason`, `note`, `is_active`,
  `created_at`, `updated_at`, `resolved_at`.
- Unicidade do ATIVO por `(user_id, flashcard_id)` — **nunca** por
  `source_group_uid`: duas layers da mesma família precisam ser marcáveis
  independentemente.
- Índices: `(user_id, is_active)`, `(user_id, source_list_id, is_active)`,
  `(user_id, flashcard_id)`. RLS ligada; o usuário só enxerga as próprias flags.
- Mutação por RPC idempotente `set_user_flashcard_review_flag(_flashcard_id,
  _enabled, _institution_id, _reason, _note)`: ON upsert/reativa; OFF
  `is_active=false` + `resolved_at=now()` (**nunca DELETE físico**). Não toca
  `flashcard_progress`, `study_sessions`, favoritos, red list, reforço nem
  Pontos de atenção.
- A flag aponta para o **flashcard/camada exato** (`displayedCard.id` /
  `statusIdentity.visibleLayerId`) e, em listas incorporadas, para o card
  **original** — sem clone, sem cópia, sem lista paralela.

## Frontend (decidido)

- `useFlashcardReviewFlags(userId)` + `useFlashcardReviewFlagMutation(userId)` com
  optimistic update e rollback + toast; query keys próprias
  (`flashcard-review-flags`, `-details`, `-count`) — **não** reutilizar
  `special-flashcards`.
- `StudyReviewFlagButton.tsx`: um clique, sem modal, `type="button"`,
  `aria-pressed`, hit target ~40–44 px, `stopPropagation` (e `onPointerDown` no
  deck) para não virar Flip, não navegar, não enviar Write, não escolher opção,
  não alterar layer.
- Posicionamento: canto superior direito da **superfície principal do card**,
  container `relative`, sem `querySelector`, sem portal por classe utilitária e
  sem CSS dependente de string de classe.
- Wiring central no `Study.tsx` (`isDisplayedReviewFlagged`,
  `handleToggleReviewFlag`) e o mesmo em `MixedStudy.tsx` via
  `MixedSlotActivity` — **nenhum modo consulta Supabase por conta própria**.
- Página privada `/review-cards` (“Revisar cards”): lista as flags abertas,
  busca os cards originais, mostra lado A/B, lista de origem, data, motivo e
  observação; filtros simples (busca, lista, motivo); reutiliza
  `EditFlashcardDialog` no ORIGINAL; “Concluir revisão” desativa a flag; sem
  permissão de edição o botão “Editar card” fica indisponível (sem
  `SECURITY DEFINER` para burlar dono). Editar **não** resolve a flag.
  Acesso pela navegação privada (Sidebar/Perfil), com badge de contagem.

## Ordem de execução sugerida (4 lotes)

1. Migration aditiva + RPC + RLS (sem aplicar remoto).
2. Hooks com optimistic update + testes A/B (mutation e identidade de layers).
3. `StudyReviewFlagButton` + wiring nos 5 modos + Mixed + testes C/D/E.
4. Página `/review-cards` + rota + edição do original + testes F/G/H.

## Testes obrigatórios (resumo da spec)

Mutation (marcar/desmarcar/idempotência/rollback) · identidade (root e layer
independentes; duas layers da mesma `source_group_uid` abertas ao mesmo tempo) ·
UI (inactive→active, pending bloqueia duplo clique) · eventos (clicar não vira
Flip, não navega, não envia Write, não escolhe MC, não altera Unscramble, não
inicia Pronunciation) · presença em todos os modos · persistência após reload ·
edição (salva no original, flag segue aberta, concluir desativa, card não é
deletado, `list_id`/`status_group_uid`/`parent_card_id` inalterados) · embedded
(aponta para o original e a relação continua intacta).

## Não fazer nesta feature

- Não tocar Pontos de atenção / `user_special_flashcards` / `set_user_attention_point`.
- Não clonar, mover ou deletar flashcard; não criar lista/pasta materializada.
- Não refatorar TTS, settings, runtime de estudo, persistência de sessão,
  Reforço, Lista Vermelha ou layout geral.
- Não incluir a flag na chave da sessão nem alterar progresso/`client_revision`.

## Pendência de ambiente (importante)

- [CONFLITO] Antes de aplicar a migration em qualquer instância: o processo de
  2026-09-15 declara `supabase_project_ref = xrnfhhoxmmstagmelvyi`, mas o banco
  real da aplicação é `ymahldldyxvwjeruaxpr` (o `xrnf…` tem 0 pastas, 0 listas e
  0 cards). Confirmar o alvo primeiro; ver
  [[sessions/2026-09-14-publicacao-mcp-producao]].

Related: [[01-CURRENT-STATE]] · [[areas/study-runtime]] · [[04-DECISIONS]] · [[08-RISKS]]
