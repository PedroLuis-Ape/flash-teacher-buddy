import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlobalImportDestinationSummary } from "./GlobalImportDestinationSummary";
import { GlobalImportExecutionSection } from "./GlobalImportExecutionSection";

const baseExecutionProps = {
  count: 224,
  mode: "existing-folder" as const,
  cardConflict: "skip" as const,
  onCardConflictChange: () => undefined,
  busy: false,
  progress: 0,
  progressText: "",
  destinationErrors: [] as string[],
  onImport: () => undefined,
  report: null,
  undoing: false,
  onUndo: () => undefined,
  onOpenFolders: () => undefined,
};

describe("confirmação final do Super Importador", () => {
  it("continua visível e explica o bloqueio quando o commit não está liberado", () => {
    const html = renderToStaticMarkup(
      <GlobalImportExecutionSection
        {...baseExecutionProps}
        enabled={false}
        disabledReason="Cards em camadas indisponíveis."
      />,
    );

    expect(html).toContain("4. Confirme a importação");
    expect(html).toContain("Ainda não importado");
    expect(html).toContain("Confirmar e importar 224 cards");
    expect(html).toContain("Cards em camadas indisponíveis.");
    expect(html).toContain("disabled");
  });

  it("mantém os detalhes repetitivos do resumo recolhíveis", () => {
    const html = renderToStaticMarkup(
      <GlobalImportDestinationSummary
        summary={{
          items: [
            {
              key: "0:0",
              sourceListName: "Termos técnicos",
              destinationFolderName: "Avançado 2.0",
              destinationListName: "Avançado 003",
              action: "append",
              cards: 224,
            },
          ],
          foldersCreated: 0,
          listsCreated: 0,
          listsUpdated: 1,
          listsReplaced: 0,
          listsSkipped: 0,
          cardsImported: 224,
          replacementListNames: [],
        }}
      />,
    );

    expect(html).toContain("Simulação — nada foi gravado");
    expect(html).toContain("<details");
    expect(html).toContain("Ver destinos das 1 listas");
    expect(html).toContain("224</strong> cards serão importados");
  });
});
