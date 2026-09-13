---
cssclasses:
  - ape-ai-note
type: session
area: study-resume
status: done
date: 2026-09-13
related:
  - "[[areas/study-resume]]"
  - "[[01-CURRENT-STATE]]"
  - "[[06-BUGS]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[12-PROCESS-LOG-2026-09-12]]"
---

# 2026-09-13 — card Voltar para onde parou preso na lista antiga

## Objetivo

O card da Home mostrava sempre Verbos frasais (14/15, 93%) mesmo depois de o
usuário estudar outras listas. Corrigir a CAUSA RAIZ do dado obsoleto no fluxo
sessão de estudo -> persistência -> fonte de verdade -> cache -> card.

## Hipótese antes da tentativa

[HYPOTHESIS] O ponteiro local de retomada não era atualizado pela superfície
mais recente (ou era tratado como prioridade absoluta), deixando o card preso
na lista anterior mesmo com sessão nova aberta em study_sessions.

## Evidência (RED -> GREEN)

- [RED] src/features/study/lib/studyResumeIntegration.test.ts falhou por dois
  defeitos reais: isSafeStudyResumePath recusava /list/ID/mixed-study e
  buildStudyPathFromRemoteSession gerava /list/ID/study?mode=mixed-adaptive
  (que o Study normaliza para flip). Saída real: expected false to be true e
  Received "/list/list-9/study?mode=mixed-adaptive&dir=any&order=random".
- [RED] O card era resolvido com o ponteiro primeiro, sem comparar com a
  sessão durável mais recente; a Prática Mista nunca publicava o ponteiro
  (usage de writeStudyResumePointer existia só em src/pages/Study.tsx).
- [GREEN] typecheck = 0; testes focados 9 arquivos / 67 testes verdes; suíte
  completa 288 arquivos / 1809 testes verdes; build exit 0 com SEO 100/100.

## Causa raiz

A fonte do card era o ponteiro local, tratado como prioridade absoluta, e só
src/pages/Study.tsx o publicava — e ainda limitado a rotas /study. A Prática
Mista (src/pages/MixedStudy.tsx, modo durável mixed-adaptive) gravava a sessão
em study_sessions mas nunca publicava o ponteiro; como a sessão antiga
continuava aberta, o card ficava preso nela para sempre.

## Correção

- src/features/study/lib/studyResumeSelection.ts: decisão por última atividade
  real, com empate no ponteiro local e tolerância de 5s de relógio.
- src/features/study/lib/studyResumeQuery.ts: consulta as duas fontes em
  paralelo, filtra instituição, ignora sessão concluída localmente e realinha o
  ponteiro para a sessão vencedora.
- src/features/study/hooks/useStudyResumePublisher.ts: camada comum de
  publicação, usada por Study.tsx e MixedStudy.tsx.
- src/features/study/lib/studyResume.ts e studyResumeRoute.ts: /mixed-study
  passa a ser rota de retomada válida e a sessão mista é reconstruída na
  superfície certa com mode=mixed.
- src/features/study/lib/studyResumeCache.ts: invalidação única de
  study-resume e home-data ao sair, concluir e fechar o percurso misto.

## Estado e limites

- [DECISAO VIGENTE] A fonte é a última atividade real de estudo (ver
  [[areas/study-resume]]); o ponteiro é cache da sessão exata do aparelho.
- Não houve commit, merge, deploy, publicação nem escrita no Supabase.
- [NAO VERIFICADO] Reprodução manual em navegador autenticado (A -> B -> C) não
  foi executada nesta sessão; os contratos foram cobertos por teste de
  integração da query com fixture A -> B -> C. Ver [[07-TESTS]] e [[08-RISKS]].

## ADAPTIVE LEARNING

- Lições usadas: [[learning/00-LEARNING-HUB]] (fonte única de verdade por
  fluxo; preservar contrato de identidade ao compor dados de camadas
  diferentes).
- Erro de previsão: a primeira versão do resolver tratava "ponteiro ausente no
  banco" como "ponteiro utilizável", o que manteve o card na lista antiga; o
  teste A -> B -> C apontou isso antes da integração nas páginas.
- Causa: fallback por coalescência entre "falha de transporte" e "sessão
  inexistente" — dois estados que exigem decisões opostas.
- Status: corrigido e retestado; nenhum anti-pattern/playbook promovido nesta
  rodada.
- Impacto no plano futuro: queries de retomada devem distinguir indisponível de
  inexistente e escolher objetos de estado inteiros, nunca campos soltos.
