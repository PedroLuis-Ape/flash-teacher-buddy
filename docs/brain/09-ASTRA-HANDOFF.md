---
cssclasses:
  - ape-ai-note
---

# Handoff
## Handoff atual — programa Descobrir/Ativar (2026-09-13)

### Onde o trabalho está

- Branch `feat/ape-public-catalog-20260913`, worktree
  `Documents/App-Piteco-Worktrees/ape-discovery-activation-20260913`.
- Base `origin/main` = `9606c902`; esta branch empilha sobre
  `feat/ape-public-materials-20260913` (`677ac072`), que por sua vez empilha
  sobre as fases 1–3 (`feat/ape-activation-home-20260913`,
  `feat/ape-chromatic-identity-20260913`, `feat/ape-guest-continuity-20260913`).
- Commits deste bloco: `d7045828` (plano), `a3cd2d26` (Task 1), `88c63d2c`
  (Task 2), `6f15bad4` (fix round 1), `4af5eb3d` (Task 3).
- **Nada foi pushado, mesclado ou publicado na Lovable.**

### Estado por task

| Task | Estado | Evidência |
| --- | --- | --- |
| 1 — RPC com busca, filtros e facetas | completa e revisada | `a3cd2d26`; `pg_proc` com exatamente 1 overload; smoke ao vivo `items: []` |
| 2 — página `/{locale}/materiais` | completa e revisada (1 fix round) | `88c63d2c`, `6f15bad4`; 21 testes; matriz mobile 320–430 px |
| 3 — prerender, canonical e sitemap | implementada, **revisão independente pendente** | `4af5eb3d`; build PASS; SEO 100/100; 1 canonical + 1 robots no HTML |
| 4 — evidência e Segundo Cérebro | em andamento | este handoff |

### Decisão que só o Pedro pode tomar

Os 5 materiais de curadoria seguem em `draft` / `is_indexable = false`.
Enquanto ele não aprovar, o catálogo mostra honestamente o estado vazio.

### Próximo passo planejado

**Implementar o Modo Reino Beta público, com SEO, Guest Mode e uso exclusivo
do modo misto gamificado.**

Estado desse próximo passo: BLOQUEADO por sequência, não por impedimento
técnico. A especificação entregue pelo Pedro
(`APE_Modo_Reino_Beta_Prompt_e_JSON_v1_1.json`) ainda **não foi lida nem
versionada**. Primeira ação do próximo agente: ler o JSON, reconciliar com
[[13-SEO-PUBLIC-WEB]], com o Guest Mode e com o Study Engine antes de planejar
qualquer implementação. Não iniciar Modo Reino antes de fechar as revisões
pendentes do bloco atual.

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
