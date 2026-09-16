---
category: library
area: library
cssclasses:
  - ape-ai-note
type: area
domain: library-list-editing
status: active
priority: high
last_reviewed: 2026-09-16
related:
  - "[[01-CURRENT-STATE]]"
  - "[[03-ARCHITECTURE]]"
  - "[[06-BUGS]]"
  - "[[07-TESTS]]"
---

# Edição de listas — pontos de entrada canônicos

## Contrato

- **"Editar lista" = editor completo em `/list/:id`** (`src/pages/ListDetail.tsx`).
  É lá que existem visualização dos cards, edição (`handleUpdateFlashcard`,
  `EditFlashcardDialog`) e exclusão individual (`handleDeleteFlashcard`).
- Em `src/pages/Folder.tsx` existe **um único helper** para isso:
  `handleOpenListEditor(list)`. Menu da visão em grade, menu da visão em lista e
  botão de lápis da linha usam o mesmo helper.
- O diálogo de título/descrição é ação **separada**: `handleRenameList(list)`,
  rotulada **"Renomear / propriedades"**
  (`library.folder.renameList` / `library.folder.renameListDescription`).
  Ele grava apenas `title` e `description`.
- `library.folder.editList` só pode rotular o caminho que abre o editor completo.

## Regressão registrada (2026-09-16)

Os itens de menu "Editar lista" chamavam `handleEditList`, que abria somente o
diálogo de metadados; o editor completo ficava acessível apenas pelo botão de
lápis visível a partir de `sm`, o que no mobile parecia perda de funcionalidade.
Corrigido; `handleEditList` não existe mais.

## Guarda

`src/features/library/listEditorEntryPoints.contract.test.ts` falha se
"Editar lista" voltar a apontar para o diálogo de metadados, se `handleEditList`
reaparecer ou se os `data-testid` dos pontos de entrada
(`list-open-editor-action`, `list-open-editor-action-row`,
`list-open-editor-icon`, `list-rename-action`, `list-rename-action-row`)
desaparecerem.

Relatório: `reports/library/2026-09-16-list-editor-entry-points.json`.
