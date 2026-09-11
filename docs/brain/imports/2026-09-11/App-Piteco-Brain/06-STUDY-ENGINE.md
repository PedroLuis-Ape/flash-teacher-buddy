---
cssclasses:
  - ape-ai-note
---

# Study Engine

## Orquestrador
**[VERIFICADO-REPO]**
`src/features/study/hooks/useStudyEngine.ts` é um ponto central e de alto risco.

## Responsabilidades
- deck/progresso;
- ordenação/inteligência;
- favoritos/red focus;
- identidade canônica vs jogável;
- session claim/restore/persist;
- snapshots;
- outbox;
- mastery/round;
- resultados;
- rewards;
- turma/engagement;
- recovery.

## Modos reconhecidos no motor
- flip
- multiple_choice
- write
- unscramble
- mixed.

O ecossistema também referencia mastery, redFocus, rewriting, highlights, race e gamified.

## Identidade
Diferenciar:
- progress card id;
- engine/playable card id;
- canonical/group id;
- displayed layer id.

Não reduzir tudo a `flashcard.id`.

## Readiness
`studySessionRuntime.ts` distingue:
- loading
- retrying
- ready
- completed
- empty
- recovering
- cancelled
- failed.

Razões incluem:
- empty-order
- index-out-of-range
- current-card-missing.

Conclusão legítima vence ausência do card atual: fim da fila não deve virar falso loading.

## Arquivos sensíveis
- `useStudyEngine.ts`
- `studySessionSnapshot.ts`
- `studySessionRepository.ts`
- `studyPersistenceOutbox.ts`
- `studySessionContext.ts`
- `restoreStudySession.ts`
- `requestedStudySession.ts`
- `studySessionFlow.ts`
- `masterySessionSnapshot.ts`
- `latestWriteQueue.ts`
- `studyProgressRepository.ts`
- `studySessionRuntime.ts`.
