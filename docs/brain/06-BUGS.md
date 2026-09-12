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

## Funcional fora do escopo

Nenhum bug de dados foi comprovado por esta auditoria visual. Problemas de persistência/importação/sessão exigem investigação separada.

## P2 — ações gigantes na tela Reforço — correção preparada

- [ROOT-CAUSE] `Button` compartilha `w-full` em viewport estreito e as ações
  locais de `src/pages/Reinforcement.tsx` não declaravam largura automática.
  Mesmo após `w-auto`, o CTA ainda podia ser esticado pelo `align-items:
  stretch` padrão do contêiner mobile.
- [FIX-IN-SOURCE] O CTA de estudo e a ação de remoção agora optam por largura
  intrínseca, e o contêiner usa `items-start`; o layout mobile organiza a ação
  principal abaixo do cabeçalho, sem alterar dados, clones, originais ou a
  lógica de mutations.
- [REVALIDATE] Revalidar no preview Lovable sincronizado, nos viewports
  320/360/375/390/412/430/768 e em desktop. O preview atualmente aberto ainda
  exibe a versão anterior, então este achado não deve ser marcado como final.

Related: [[12-PROCESS-LOG-2026-09-12]] · [[07-TESTS]] · [[08-RISKS]] · [[areas/visual-polish]]
