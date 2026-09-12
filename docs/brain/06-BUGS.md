---
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
