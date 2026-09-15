---
category: documentation
type: session-checkpoint
status: active
area: study
date: 2026-09-15
related:
  - "[[2026-09-15-plano-revisar-cards]]"
  - "[[areas/study-runtime]]"
  - "[[areas/supabase-runtime]]"
---

# Finalização — Revisar cards / Revisar depois

## Estado desta rodada

- [VERIFIED-REPO] O lote anterior havia parado explicitamente antes de `MixedStudy`, da central `/review-cards` e da aplicação remota da migration.
- [IMPLEMENTED] A central privada `/review-cards` lista flags abertas, busca o flashcard original, mostra lista/origem/motivo/observação, reutiliza `EditFlashcardDialog`, mantém a flag aberta depois de editar e só resolve por ação explícita `Concluir revisão`.
- [IMPLEMENTED] `MixedStudy` passou a usar a mesma fila por identidade exata do card/camada visível, com um único hook/mutation no parent e props semânticas entregues às atividades.
- [IMPLEMENTED] A Sidebar ganhou acesso `Revisar cards` com contador e prefetch por intenção; a rota foi adicionada a `App.tsx`, RUM e robots privados.
- [IMPLEMENTED] O domínio ganhou metadata de revisão (`translation`, `context`, `grammar`, `typo`, `naturalness`, `answer`, `audio`, `other`) e RPC própria para editar motivo/nota sem alterar o conteúdo do card.
- [HARDENED] A mutation de toggle usa identidade exata `(user_id, flashcard_id)`, advisory lock, soft resolve e a mesma fronteira de leitura usada pelas superfícies de estudo. Não clona, move ou apaga flashcards e não toca progresso/sessão/favoritos/Lista Vermelha/Reforço/Pontos de atenção.

## Validação

- [VERIFIED-CI] Workflow isolado da branch: contratos focados PASS; `npm run typecheck` PASS; ESLint dos arquivos tocados PASS; `npm run build` PASS.
- [VERIFIED-TEST] Contrato `reviewCardsFeature.contract.test.ts` protege identidade exata, separação de Pontos de atenção, isolamento de eventos, presença nos cinco modos normais, wiring do Mixed, edição do original e soft resolution.

## Backend remoto

- [ENVIRONMENT] Runtime de dados de produção confirmado pelo contrato canônico do repo: `ymahldldyxvwjeruaxpr`. `xrnfhhoxmmstagmelvyi` é o projeto gerenciado/tooling e não contém os dados reais do app.
- [BLOCKER-IF-STILL-PRESENT] O conector Supabase desta sessão não possui permissão administrativa no projeto `ymahldldyxvwjeruaxpr`. A migration não deve ser aplicada no `xrnf...` para contornar isso.
- A migração base é `supabase/migrations/20260915120000_user_flashcard_review_flags.sql` e o endurecimento/finalização é `supabase/migrations/20260915133000_finalize_user_flashcard_review_flags.sql`.

## Contrato final

`Marcar no jogo` → metadata lateral persistida no Supabase → `/review-cards` referencia o original → `Editar card` altera o original com as permissões normais → flag continua aberta → `Concluir revisão` faz soft resolve. Nenhum clone, move, DELETE de card ou mutação do progresso da sessão.
