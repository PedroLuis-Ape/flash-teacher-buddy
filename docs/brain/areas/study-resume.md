---
category: game
area: study
cssclasses:
  - ape-ai-note
type: area
domain: study-resume
status: active
priority: high
last_reviewed: 2026-09-13
related:
  - "[[01-CURRENT-STATE]]"
  - "[[03-ARCHITECTURE]]"
  - "[[06-BUGS]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[areas/adaptive-learning]]"
  - "[[12-PROCESS-LOG-2026-09-12]]"
  - "[[sessions/2026-09-13-resume-card-ultima-sessao]]"
---

# Retomada de estudo e card Voltar para onde parou

## Propósito

Registrar de onde o card da Home tira a retomada, o que cada camada pode
garantir e como verificar isso sem reler o código a cada retomada.

## Fonte de verdade

1. A tabela study_sessions (sessões abertas do usuário, ordenadas por
   updated_at) é a atividade real de estudo, independente da superfície que a
   criou.
2. A chave local ape_state_study_resume:v2:[escopo] é o cache da sessão exata
   do aparelho (sessionId, card, camada, configurações).
3. src/features/study/lib/studyResumeSelection.ts decide: vence a maior
   updatedAt; empate fica com o ponteiro local; diferença dentro de 5s é
   tratada como desvio de relógio entre aparelho e servidor.
4. src/features/study/lib/studyResumeQuery.ts consulta as duas fontes, filtra
   pelo escopo de instituição e realinha o ponteiro para a sessão vencedora,
   para que o botão Continuar abra exatamente o que o card mostra.

## Camada comum das superfícies de estudo

src/features/study/hooks/useStudyResumePublisher.ts é a única forma de
publicar o ponteiro. É usado por src/pages/Study.tsx (flip, write,
multiple-choice, unscramble, pronunciation) e por src/pages/MixedStudy.tsx
(rota /list/:id/mixed-study, modo durável mixed-adaptive). Uma sessão nova em
qualquer superfície passa a assumir o card.

## Invalidação

src/features/study/lib/studyResumeCache.ts invalida as chaves study-resume e
home-data no React Query. É chamado ao sair com Salvar e sair, ao concluir e
quando a Prática Mista fecha o percurso — sem reload, logout ou limpeza de
cache.

## Invariantes

- Lista, título, progresso, destino e sessionId sempre pertencem à MESMA
  sessão; a seleção escolhe objetos inteiros, nunca campos de fontes
  diferentes.
- A rota aceita de retomada é privada: /list/ID/(study|mixed-study) ou
  /collection/ID/(study|mixed-study). Rota pública /portal/... nunca entra no
  ponteiro.
- Escopo anon (visitante) e escopo do usuário são chaves diferentes e não se
  cruzam; a ponte visitante para conta continua em
  src/features/guest/guestStateBridge.ts.
- Sessão com modo mixed ou mixed-adaptive é retomada em /mixed-study com
  mode=mixed; mixed-adaptive nunca é enviado para /study (lá viraria flip).

## Como verificar

- Testes focados: src/features/study/lib/studyResumeQuery.test.ts (A -> B -> C,
  escopo de instituição, título/progresso/destino coerentes, degradação sem
  mentir) e src/features/study/hooks/useStudyResumePublisher.test.tsx
  (publicação pelo Study e pela Prática Mista, recusa de rota pública).
- Typecheck: tsc --noEmit -p tsconfig.app.json.

## Limites

- A Prática Mista ignora o parâmetro técnico resume_session: ela retoma a
  sessão compatível mais recente da lista. Na prática é a sessão do card;
  divergência só apareceria com outra sessão mais nova da mesma lista e
  escopo. Ver [[08-RISKS]].
- Nenhum schema, RLS, RPC ou migration foi alterado por esta correção.
