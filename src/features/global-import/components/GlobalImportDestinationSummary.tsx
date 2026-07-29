import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { GlobalImportDestinationSummary as Summary } from "../destinationSummary";

interface Props {
  summary: Summary;
}

function actionLabel(item: Summary["items"][number]): string {
  if (item.action === "skip") return "Não será importada";
  if (item.action === "create") return `Nova lista “${item.destinationListName}”`;
  if (item.action === "replace") return `Substituir a lista “${item.destinationListName}”`;
  return `Adicionar à lista “${item.destinationListName}”`;
}

export function GlobalImportDestinationSummary({ summary }: Props) {
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-semibold">3. Revise o resumo do destino</h2>
        <p className="text-sm text-muted-foreground">
          Este resumo é calculado diretamente do plano que será enviado ao banco.
        </p>
      </div>

      <div className="space-y-2">
        {summary.items.map((item) => (
          <div key={item.key} className="rounded-lg border p-3 text-sm">
            <div className="font-medium">{item.sourceListName}</div>
            <div className="mt-1 flex items-start gap-2 text-muted-foreground">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">
                {item.action === "skip"
                  ? actionLabel(item)
                  : `${item.destinationFolderName} · ${actionLabel(item)}`}
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {item.action === "skip" ? `${item.cards} card(s) ignorados` : `${item.cards} card(s) importados`}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Metric value={summary.foldersCreated} label="pastas serão criadas" />
        <Metric value={summary.listsCreated} label="listas serão criadas" />
        <Metric value={summary.listsUpdated} label="listas existentes serão atualizadas" />
        <Metric value={summary.listsSkipped} label="listas serão ignoradas" />
        <Metric value={summary.cardsImported} label="cards serão importados" />
      </div>

      {summary.replacementListNames.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <strong>Atenção:</strong>{" "}
            {summary.replacementListNames.map((name) => `“${name}”`).join(", ")}{" "}
            {summary.replacementListNames.length === 1 ? "será substituída" : "serão substituídas"}.
          </div>
        </div>
      )}
    </Card>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
      <span><strong>{value}</strong> {label}</span>
    </div>
  );
}
