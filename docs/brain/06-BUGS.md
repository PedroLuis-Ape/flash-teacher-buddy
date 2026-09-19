---
category: bug
area: piteco
status: active
cssclasses:
  - ape-ai-note
---

# Bugs e achados

## P1 — safe-area / barra inferior

A tabbar fixa não reserva fluxo sozinha. O commit `cc6ccc45` moveu a reserva para o wrapper de conteúdo/footer, separou o padding da barra e fortaleceu o contrato CSS. Ainda falta confirmar com screenshots e emulação de inset.

## P1 — overlays em viewport baixa

Auditoria encontrou dialogs/sheets sem composição uniforme `header / body rolável / footer seguro`, especialmente ListDetail, Folder, import/export, MergeIntoLayers e alguns sheets de estudo.

## P2 — navegação

Há offsets sticky históricos diferentes, `navigate(-1)` direto em várias telas, swipe de borda sem bloqueio uniforme e ações hover-only/icon-only que precisam de foco/touch equivalente.

## P2 — temas e drawers

Parte das regras do drawer está carregada junto da camada Galaxy; testar paletas não-Galaxy antes de generalizar.

## P1 — Ponto de atenção não materializa Reforço no preview — 2026-09-12

- [VERIFIED-CUA] Marcar Ponto de atenção no card ativou e permitiu remoção
  reversível, mas a Home continuou em `0 cards para revisar` e `/reinforcement`
  ficou vazio.
- [CONTRATO A CONFIRMAR] O botão Reforço separado materializou e removeu o
  card corretamente. A pendência é a ligação entre os dois fluxos, sem tocar no
  card original.
- [NEXT] Revisar mutation/service canônica, invalidação das queries e cobertura
  de mark/unmark/remarcação/camadas.

## P0 — "Voltar para onde parou" voltava para lista antiga — corrigido em 2026-09-15

- [ROOT-CAUSE] três causas somadas: o hook da Home não fornecia o
  localStorage (ponteiro local fora da seleção), updated_at técnico era tratado
  como atividade do usuário, e a consulta ignorava sessões concluídas, deixando
  uma sessão velha ainda aberta assumir o card.
- [FIX] marcador dedicado de atividade em study_sessions
  (last_activity_at/revision/card/index/layer) escrito só pelo RPC
  touch_study_session_activity_v1, seleção por atividade real, sessão concluída
  não retomável e publicação apenas por mudança de identidade de atividade.
- [REGRESSION-CONTRACT] src/features/study/lib/studyResumeActivity.contract.test.ts
- [NEXT] validação visual em preview autenticado (mobile e desktop).

## P1 — Flip extenso aceitava Sabia/Não Sabia — corrigido em 2026-09-15

- [ROOT-CAUSE] a view do Flip não recebia o fluxo de estudo e renderizava
  sempre a avaliação; o listener próprio também tratava next/prev, e
  useKeyboardShortcuts não checava defaultPrevented (duas navegações por seta).
- [FIX] prop studyFlowMode com dono único da avaliação, avaliação escondida e
  inerte em continuous, next/prev apenas no roteador global e navegação livre
  no Flip extenso.
- [REGRESSION-CONTRACT] src/features/study/components/flipAssessmentContract.test.ts

## Funcional fora do escopo

Nenhum bug de dados foi comprovado por esta auditoria visual. Problemas de persistência/importação/sessão exigem investigação separada.

## P2 — ações icon-only herdando `w-full` no mobile — corrigido em 2026-09-12

- [ROOT-CAUSE] `src/components/ui/button.tsx` aplica `w-full` abaixo do
  breakpoint `sm`. Uma ação icon-only sem largura intrínseca ocupa a linha
  inteira: `min-w-11` e `shrink-0` não reduzem a largura, e o texto irmão com
  `flex-1 min-w-0` colapsa para `0 px`.
- [VERIFIED-REPO] Varredura completa do `src` encontrou exatamente dois casos
  reais: `src/pages/Reinforcement.tsx` (remover do Reforço) e
  `src/pages/ListDetail.tsx` (gatilho "Mais ações da lista"). Botões com
  `size="icon"` não são afetados porque o `tailwind-merge` descarta `w-full`.
- [SUPERSEDED] A correção preparada em `75ba3e44` para a versão anterior da
  tela de Reforço foi substituída por esta; aquele registro permanece como
  histórico em [[12-PROCESS-LOG-2026-09-12]].
- [FIX] `w-auto` declarado localmente nas duas ações. O `Button` global, o CTA
  principal e a semântica de dados permaneceram intactos.
- [REGRESSION-CONTRACT] `src/hooks/useReinforcement.contract.test.ts` e
  `src/pages/__tests__/listDetailResponsive.contract.test.ts`.
- [INTEGRADO] Commit `eea3261c` em `origin/main` (`c1769c3b..eea3261c`).
- [VERIFIED-RUNTIME] Conferido no preview autenticado do Lovable em 2026-09-12,
  modo mobile (393 px), rodando o commit `f522aea7`: ação de remover 48x44 px,
  título do card 252 px, CTA `Estudar agora` 312 px e `scrollWidth` 378 sem
  overflow horizontal. Em modo desktop as ações permaneceram 48x44 px.

Related: [[12-PROCESS-LOG-2026-09-12]] · [[07-TESTS]] · [[08-RISKS]] · [[areas/visual-polish]] · [[areas/adaptive-learning]]

## P2 — orientação A/B, labels e TTS no estudo — corrigido em 2026-09-13

- [ROOT-CAUSE] A metadata `lang_a/lang_b` contradizia o conteúdo legado de alguns decks; o `MixedStudy` ainda resolvia idioma/labels manualmente, não carregava `tts_enabled` e não repassava labels às views. As views então falavam e rotulavam o lado pela metadata incorreta.
- [FIX] O runtime agora usa `resolveEffectiveListSettings` no Mixed e projeta uma orientação efetiva somente quando há pelo menos 8 pares high-confidence com consenso de 80%; texto e identidade de card permanecem inalterados.
- [FIX] `src/lib/languageClassifier.ts` é compartilhado pela auditoria e pelo runtime. MC, Write e Unscramble recebem labels/`ttsEnabled`; o locale do TTS deriva do lado efetivamente exibido.
- [REGRESSION-CONTRACT] `src/features/study/lib/resolveDeckOrientation.test.ts` cobre a-b, b-a, any, deck legado invertido, frases curtas/ambíguas, amostra pequena, resolver do Mixed, coleções de sistema e `speechSynthesis`.
- [FOLLOW-UP] `gameCore.ts` ainda tem resolver duplicado; wrappers podem recalcular direção; `PronunciationStudyView` ainda fala sempre `sideB`.
- [STATUS] Implementação local em validação final; não houve escrita no banco, migration, merge, push ou deploy.

Related: [[sessions/2026-09-13-ab-language-orientation]] · [[07-TESTS]] · [[08-RISKS]] · [[areas/adaptive-learning]]
## P2 — nomes de lista e de turma ilegíveis no mobile — corrigido em 2026-09-12

- [ROOT-CAUSE] Na pasta, o cluster de ações usa o `Button` compartilhado, que
  impõe `min-w-[44px]`. Quatro ações somam ~188 px numa linha de 344 px e o
  título recebia só 76 px, sem possibilidade de quebra.
- [ROOT-CAUSE] Na Home, a grade de turmas tem duas colunas em 393 px e o nome
  usava `truncate`: ~98 px de espaço para nomes de até 185 px.
- [FIX] `src/pages/Folder.tsx` passou a usar `flex-wrap` na linha e
  `min-w-[9rem]` no título, então as ações descem para a segunda linha em
  telas estreitas. `src/components/TurmaShortcut.tsx` passou a usar
  `line-clamp-2 break-words` no nome.
- [VERIFIED-RUNTIME] Medição com o CSS compilado, container de 346 px: o nome
  ia de `78px` (precisava de 139) para `139px` sem corte; a linha cresce de
  `68px` para `115px` porque as ações quebram.
- [REGRESSION-CONTRACT] `src/pages/__tests__/mobileTitleLegibility.contract.test.ts`.
- [INTEGRADO] Commit `3a836650` em `origin/main`.
- [PENDING] A conferência no preview autenticado desta segunda correção não
  foi concluída: o iframe do preview parou de aceitar inspeção após o refresh.

Related: [[12-PROCESS-LOG-2026-09-12]] · [[07-TESTS]] · [[08-RISKS]] · [[areas/visual-polish]] · [[areas/adaptive-learning]]
## BUG — Lista pública indisponível: camada de publicação nunca aplicada (2026-09-13)

[VERIFIED-RUNTIME] `/portal/list/{id}` renderiza "Lista pública indisponível" (~3s). Evidência de rede
capturada por CDP no build de produção:

```
rpc/get_public_learning_list        -> HTTP 404   (função não existe)
lists?select=...                    -> HTTP 401   (anon não pode ler a tabela; RLS)
```

[VERIFIED-DB] Em produção (`ymahldldyxvwjeruaxpr`) NÃO existem:
`public_entity_publications`, `public_learning_list_entries`, `is_public_learning_list`,
`get_public_learning_list`, `get_public_learning_list_card_preview` — 0 de 3 funções presentes.

[CONFLITO] A migration do repositório `20260713152000_public_learning_list_pages.sql` **não pode ser
aplicada como está**: depende de `public.public_entity_publications`, que também não existe em produção.
O fallback do próprio cliente (`loadLegacyPublicList`) também não funciona, porque depende de leitura
direta de `lists` por `anon` — negada pela RLS (401).

[IMPACTO] A página de lista do portal não abre; o convite de visitante da Fase 3 (`GuestAccountInvite`,
montado só nessa página) fica inalcançável. O restante do fluxo (catálogo → hub de jogos → estudo) não
passa por essa camada e funciona.

[DECISÃO PENDENTE — requer o Pedro] Duas saídas: (a) reimplementar `get_public_learning_list` e
`..._card_preview` contra a regra pública vigente (`visibility='class'`, `class_id IS NULL`,
`deleted_at IS NULL`, dono com `is_teacher`, `public_access_enabled`, `public_profile_searchable` e
`public_slug`), sem a camada de registro — mesma decisão já tomada na Fase 4 para os materiais curados;
(b) aplicar a camada de registro completa, inclusive `public_entity_publications` — mais superfície e um
segundo sistema de publicação convivendo com a regra vigente.

[VERIFIED-DB] Todas as colunas que a regra exige existem em produção e o único professor público cumpre
os requisitos, então a opção (a) é executável.
[PREPARADO — não aplicado] `supabase/migrations/20260913230000_public_learning_list_runtime_v1.sql`
cria as 3 funções reutilizando a regra pública vigente (corpos extraídos da migration original por
script, sem redigitar), com `search_path` fixo, `revoke` de PUBLIC e `grant` para `anon, authenticated`,
mais backup e rollback escritos no arquivo. Coberto por contrato em
`src/lib/__tests__/publicLearningListRuntime.contract.test.ts` (5 asserções). A regra foi validada em
produção por leitura: retorna a lista com 33 cards, pasta e autor. **Nada foi aplicado no banco** —
aguarda decisão do Pedro.
## Bug visual sistêmico — camada derivada de tokens removida (2026-09-13)

[ROOT CAUSE] O refactor de identidade (0b711050) removeu de space-layouts.css a camada DERIVADA
--ape-* (surface, button, page, soft, muted, nav, banner, shadow), mas ~40 regras de space-ui-*.css
continuaram usando var(--ape-*). Custom property inexistente invalida a declaração inteira: background
vira transparente e box-shadow some. Efeito: botões primários invisíveis (o caso Sabia ao lado de
Não Sabia), cards sem superfície, áreas quebradas. Confirmado no runtime: --ape-* vazios em html,
body e .space-ui.

[FIX] space-ui-v1.css passou a DERIVAR a camada dos tokens canônicos em html[data-palette]{...}
(surface=hsl(var(--card)), button=gradiente de hsl(var(--primary)), nav-text=muted-foreground), valendo
para as 4 paletas sem duplicar cor. Segunda correção: semânticos por base (html[data-palette].light/.dark)
porque :root trazia pares reprovados em AA (destructive+branco 3.82:1; warning+branco 2.14:1).

[GUARD] src/lib/__tests__/apeTokensDefined.contract.test.ts falha se qualquer var(--ape-*) do CSS ficar
sem definição — exatamente a regressão que causou o bug.

[LIÇÃO] var() inexistente não gera erro: apenas apaga a propriedade. Ao refatorar tokens, mover as
camadas derivadas junto e cobrir com teste de definição.

[VERIFIED] Após o fix: card rgb(23,26,33), primário teal ~11:1, destructive 5.42:1, light destructive
5.4:1, light success 5.8:1, build com SEO 100/100.

## Convite da extensão não aparecia na landing pública — corrigido em 2026-09-13

- [ROOT-CAUSE] Duas barreiras somadas: (1) `ExtensionInstallPrompt` só era montado
  em `PrivateShell`, que o `GlobalLayout` só renderiza em rota protegida autenticada
  (`/` é público); (2) o próprio componente exigia `authenticated` e só então
  habilitava o ping, então sem login o status ficava `"unknown"`.
- [SINTOMA] Visitante em desktop Chromium, sem a extensão e sem snooze, nunca via o
  convite — `finalEligibility = false` com `reasonNotShown` = gate de autenticação +
  superfície não montada.
- [FIX] Política única em `extensionPromptPolicy.ts` (superfície + 7 gates com motivo)
  e UM ponto de montagem (`BrowserExtensionPromptMount`) em `GlobalLayout`; o gate de
  autenticação deixou de existir na landing. Auto-dismiss, snooze de 7 dias, X, CTA
  para a Chrome Web Store em nova aba, espera de 5 s e auto-dismiss de 15 s preservados.
- [REGRESSION-CONTRACT] `extensionIntegration.test.tsx` (A..J + K1–K5 + M1–M5),
  `extensionPromptPolicy.test.ts` (matriz dos 7 gates e das superfícies) e
  `browserExtension.contract.test.ts` (exatamente um ponto de montagem no app).
- [STATUS] Corrigido e verde localmente; QA em navegador real com a extensão instalada
  segue pendente.

Related: [[areas/browser-extension]] · [[sessions/2026-09-13-convite-extensao-landing-publica]] · [[07-TESTS]] · [[08-RISKS]]


## P1 — card "Voltar para onde parou" preso na lista antiga — corrigido em 2026-09-13

[SINTOMA] O card continuava em "Verbos frasais 14 de 15 (93%)" depois de o
usuário estudar outras listas; nenhum login, reload ou limpeza de cache mudava.

[ROOT-CAUSE] A Home resolvia a retomada com o ponteiro local primeiro e só
consultava sessões duráveis quando ele não existia
(src/hooks/useLatestStudyResume.ts, revisão 53aa3cf6), e o ponteiro só era
publicado por src/pages/Study.tsx — ainda limitado a rotas /study por
src/features/study/lib/studyResume.ts:14. A Prática Mista
(src/pages/MixedStudy.tsx, modo durável mixed-adaptive) gravava a sessão em
study_sessions mas nunca publicava o ponteiro; com a sessão antiga ainda aberta,
o card ficava preso nela indefinidamente.

[FIX] src/features/study/lib/studyResumeSelection.ts decide pela última
atividade real (updated_at), empate no ponteiro, tolerância de 5s de relógio;
src/features/study/lib/studyResumeQuery.ts consulta as duas fontes, filtra
instituição, ignora conclusão marcada localmente e realinha o ponteiro para a
sessão vencedora; src/features/study/hooks/useStudyResumePublisher.ts é a
camada comum de publicação usada por Study.tsx e MixedStudy.tsx;
studyResumeRoute.ts retoma sessão mista em /mixed-study?mode=mixed;
studyResumeCache.ts invalida study-resume e home-data ao sair, concluir e
fechar o percurso misto.

[REGRESSION-CONTRACT] src/features/study/lib/studyResumeQuery.test.ts (A -> B ->
C, escopo de instituição, título/progresso/destino coerentes, conclusão,
degradação sem mentir), studyResumeSelection.test.ts,
studyResumeCache.test.ts, useStudyResumePublisher.test.tsx e as asserções de
rota mista em studyResumeIntegration.test.ts.

[STATUS] Corrigido e validado localmente (tsc 0, suíte completa 288 arquivos /
1809 testes verdes, build exit 0 e SEO 100/100). Sem commit, merge, deploy ou
escrita no Supabase. Ver [[areas/study-resume]] e
[[sessions/2026-09-13-resume-card-ultima-sessao]].

## P1 — estado derivado sobrevive ao card que saiu do deck — corrigido em 2026-09-19

- [ROOT-CAUSE] Flashcards usam soft delete (`deleted_at`). As FKs
  `ON DELETE CASCADE` de `user_red_list`, `user_special_flashcards`,
  `user_flashcard_review_flags`, `user_reinforcement_points` e
  `flashcard_progress` só disparam em DELETE físico, então não limpam nada no
  fluxo normal de exclusão.
- [ROOT-CAUSE] `user_favorites` virou tabela genérica sem FK para flashcards:
  o favorito sobrevivia à exclusão definitiva do card.
- [ROOT-CAUSE] Leituras globais (`useFavorites` sem escopo, `useRedList` sem
  escopo, `useSpecialFlashcards*` e a fila de revisão) devolviam ids e
  contagens de cards mortos, enquanto o RPC escopado equivalente já filtrava
  `deleted_at IS NULL`.
- [FIX] Regra única de identidade em `src/features/cards/lib/liveFlashcardIds.ts`
  aplicada a favoritos, Lista Vermelha, Pontos de atenção, Reforço e Revisar
  cards; contagem de atenção derivada das mesmas referências vivas.
- [FIX] `useLatestStudyResume` só oferece retomada quando a lista ainda tem
  card vivo, cobrindo Delete All e reimportação.
- [FIX] Migration `20260919120000_flashcard_derived_state_invalidation_v1.sql`
  com pruning de órfãos reais e trigger de limpeza no DELETE físico.
- [FIX] Invalidação imediata de cache em exclusão simples, bulk, desfazer e
  lixeira via `src/features/cards/lib/derivedStateInvalidation.ts`.
- [REGRESSION-CONTRACT] `src/features/cards/lib/__tests__/derivedStateInvalidation.test.ts`.
- [PENDING] Migration ainda não aplicada em `ymahldldyxvwjeruaxpr`; o conector
  Supabase desta sessão não tem permissão nesse projeto.

Related: [[sessions/2026-09-19-flashcard-derived-state-invalidation]] · [[07-TESTS]] · [[08-RISKS]] · [[areas/supabase-runtime]] · [[areas/study-resume]]
