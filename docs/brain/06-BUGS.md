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
