---
cssclasses:
  - ape-ai-note
---

# Area — Sessions

## Arquivos
`useStudyEngine.ts`, `studySessionSnapshot.ts`, `studySessionRepository.ts`,
`studyPersistenceOutbox.ts`, `studySessionRuntime.ts`,
`studySessionContext.ts`, `restoreStudySession.ts`, `requestedStudySession.ts`.

## Contratos
- exact resume;
- no empty order;
- local snapshot imediato;
- outbox durável;
- remote durable;
- multi-tab protection;
- preset ≠ session.

## Checklist
- [ ] produção real
- [ ] refresh
- [ ] offline/online
- [ ] duas abas
- [ ] último card
- [ ] completed
- [ ] deck alterado
- [ ] mastery
- [ ] mixed
- [ ] Rewrite restore.

## Risco
Admin DB não expõe as colunas/RPCs modernos esperados pelo caminho completo.
