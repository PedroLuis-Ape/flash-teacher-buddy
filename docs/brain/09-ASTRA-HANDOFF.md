---
cssclasses:
  - ape-ai-note
---

# Handoff
## Handoff atual — fechamento do programa Descobrir/Ativar (2026-09-13)

### Onde o trabalho está

- [FATO CONFIRMADO] Worktree: `C:\Users\pedro\Documents\App-Piteco-Worktrees\ape-discovery-activation-20260913`.
- [FATO CONFIRMADO] Branch: `integration/ape-program-20260913`; HEAD
  `0298f10f`.
- [FATO CONFIRMADO] As cinco fases do programa estão integradas nesta branch;
  as correções dos achados das revisões estão nos commits `cf87e385`,
  `114df294`, `890ec291`, `1112091a` e `cc6e8f8a`.
- [DECISAO VIGENTE] A branch é LOCAL: não foi pushada, mesclada nem publicada
  na Lovable. Publicar ou mesclar é decisão do Pedro.

### Estado final por bloco

| Task | Estado | Evidência |
| --- | --- | --- |
| Fases 1–3 — ativação, cor e continuidade | integradas | `ddd20ec5`, `a0e536c7`, `b73c9f26` |
| Fases 4–5 — materiais, catálogo, GEO e medição | integradas com correções | HEAD `0298f10f`; sessões de 2026-09-13 |
| Gates locais | verificados nas sessões | typecheck, 276/1709 testes, lint, build, SEO 100/100, browser e banco |

### Decisão que só o Pedro pode tomar

Os 5 materiais de curadoria seguem em `draft` / `is_indexable = false`.
Enquanto ele não aprovar, o catálogo mostra honestamente o estado vazio.

### Próximo passo planejado

**Próximo passo planejado: implementar o Modo Reino Beta público, com SEO, Guest Mode e uso exclusivo do modo misto gamificado.**

[NEEDS_RECONCILIATION] Esse próximo passo está bloqueado por decisão e
sequência, não por impedimento técnico. A especificação entregue pelo Pedro
(`APE_Modo_Reino_Beta_Prompt_e_JSON_v1_1.json`) ainda **NÃO foi lida nem
versionada**. Quando Pedro decidir iniciar, a primeira ação será ler o JSON e
reconciliar seu contrato com [[13-SEO-PUBLIC-WEB]], com o Guest Mode e com o
Study Engine (`useStudyEngine.ts` e a identidade de sessão/modo). Nada deve
começar antes de o Pedro decidir.

---


## [HISTORICAL] Retomar assim — plano de polish visual (2026-09-11)

1. Ler [[01-CURRENT-STATE]] e [[sessions/interruption-checkpoint-001]].
2. Confirmar `git status`, branch e o diff de `cc6ccc45` no worktree isolado.
3. Reabrir o app Piteco correto no navegador; não assumir que a aba Lovable está disponível.
4. Capturar a matriz mínima: Home, biblioteca, pasta, detalhe de lista, Games Hub e um jogo em 320/390/768/1280.
5. Corrigir somente problemas observados e registrar antes/depois.
6. Rodar os comandos finais do plano e revisar que nenhum arquivo Supabase/lógica foi incluído.

## [HISTORICAL] Estado da entrega — plano de polish visual (2026-09-11)

Não está autorizada a afirmação de “pronto para publicação” ainda. O próximo marco é completar o loop visual e o relatório de release.

## Handoff técnico — estudo A/B — 2026-09-13

- [FATO CONFIRMADO] A branch permanece local; não foi pushada, mesclada ou publicada.
- [FATO CONFIRMADO] A correção está fechada com gates locais verdes e relatório em `.superpowers/sdd/ab-bug-report.md`.
- [FOLLOW-UP] Para uma task futura, revisar `gameCore.ts`, wrappers que recalculam direção e `PronunciationStudyView` que sempre fala `sideB`; não reabrir este lote por essas melhorias opcionais.
