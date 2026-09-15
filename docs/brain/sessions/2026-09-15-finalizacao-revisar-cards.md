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
- [KNOWN-BASELINE] O workflow geral do PR ainda encontra a falha SEO/robots já documentada em `08-RISKS.md` e já presente no `main`: grupo específico `OAI-SearchBot`. O build de produção do mesmo run concluiu e o score `seo-visibility` permaneceu 100/100; essa dívida não foi criada por Revisar cards.

## Backend remoto

- [ENVIRONMENT] Runtime de dados real foi validado pelo próprio projeto Lovable conectado ao App Piteco: contém as listas `Avançado 001` e `Verbos frasais`. O projeto gerenciado/tooling `xrnfhhoxmmstagmelvyi` continua separado e não foi usado como atalho.
- [APPLIED-PRODUCTION] A migration base `supabase/migrations/20260915120000_user_flashcard_review_flags.sql` foi aplicada no banco real conectado ao app.
- [APPLIED-PRODUCTION] O endurecimento `supabase/migrations/20260915133000_finalize_user_flashcard_review_flags.sql` também foi aplicado.
- [VERIFIED-PRODUCTION] `user_flashcard_review_flags` existe; RPCs `set_user_flashcard_review_flag` e `update_user_flashcard_review_flag_metadata` existem; índice ativo único por `(user_id, flashcard_id)` existe; fila iniciou com 0 registros.
- [MIGRATION-HISTORY] As versões `20260915120000` e `20260915133000` foram registradas em `supabase_migrations.schema_migrations`, evitando reaplicação futura pelo pipeline normal.

## Contrato final

`Marcar no jogo` → metadata lateral persistida no Supabase → `/review-cards` referencia o original → `Editar card` altera o original com as permissões normais → flag continua aberta → `Concluir revisão` faz soft resolve. Nenhum clone, move, DELETE de card ou mutação do progresso da sessão.
