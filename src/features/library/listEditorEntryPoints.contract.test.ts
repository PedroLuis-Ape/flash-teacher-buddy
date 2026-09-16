import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FOLDER = readFileSync(path.join(process.cwd(), "src/pages/Folder.tsx"), "utf8");
const LIST_DETAIL = readFileSync(path.join(process.cwd(), "src/pages/ListDetail.tsx"), "utf8");

/**
 * Regressão: "Editar lista" havia passado a abrir apenas o diálogo de
 * título/descrição, escondendo o editor completo (cards, edição e exclusão
 * individual) que vive em /list/:id.
 */
describe("pontos de entrada de edição de lista", () => {
  it("expõe um único helper que abre o editor completo em /list/:id", () => {
    expect(FOLDER).toContain("const handleOpenListEditor = (list: ListType) => {");
    expect(FOLDER).toContain("navigate(`/list/${list.id}`)");
  });

  it("todo rótulo 'Editar lista' chama o editor completo, nunca o diálogo de metadados", () => {
    const occurrences = FOLDER.split("Editar lista");
    // rótulos nos dois menus + aria-label do botão de lápis
    expect(occurrences.length - 1).toBeGreaterThanOrEqual(3);

    const editorItems = FOLDER.match(/handleOpenListEditor\(list\)/g) ?? [];
    expect(editorItems.length).toBeGreaterThanOrEqual(3);

    expect(FOLDER).toContain('data-testid="list-open-editor-action"');
    expect(FOLDER).toContain('data-testid="list-open-editor-action-row"');
    expect(FOLDER).toContain('data-testid="list-open-editor-icon"');
  });

  it("não existe mais handleEditList apontando para o diálogo de metadados", () => {
    expect(FOLDER).not.toContain("handleEditList");
  });

  it("o diálogo de metadados é apresentado como renomear/propriedades", () => {
    expect(FOLDER).toContain("const handleRenameList = (list: ListType) => {");
    expect(FOLDER).toContain("Renomear / propriedades");
    expect(FOLDER).toContain('data-testid="list-rename-action"');
    expect(FOLDER).toContain('data-testid="list-rename-action-row"');
    expect(FOLDER).toContain('t("library.folder.renameList")');
    // renomear continua salvando apenas título e descrição
    expect(FOLDER).toContain("title: editingList.title");
    expect(FOLDER).toContain("description: editingList.description");
  });

  it("mantém gerenciamento de listas combinadas e o editor completo intactos", () => {
    expect(FOLDER).toContain("setManagingEmbeddedList(list)");
    expect(LIST_DETAIL).toContain("handleUpdateFlashcard");
    expect(LIST_DETAIL).toContain("handleDeleteFlashcard");
    expect(LIST_DETAIL).toContain("EditFlashcardDialog");
  });
});
