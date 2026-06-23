import { AlertTriangle, FolderTree } from "lucide-react";
import { summarizeSmartImport } from "@/features/smart-import/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GlobalImportList, GlobalImportPackage } from "../schema";
import type { GlobalImportV2ValidationResult } from "../validation";

interface Props {
  validation: GlobalImportV2ValidationResult;
  packageValue: GlobalImportPackage | null;
  counts: { folders: number; lists: number; cards: number };
  notes: string[];
  destinationErrors: string[];
  destinationWarnings: string[];
}

function sourceLabel(sourceFormat: GlobalImportV2ValidationResult["sourceFormat"]): string {
  if (sourceFormat === "official") return "Contrato oficial 1.0";
  if (sourceFormat === "canonical") return "Compatibilidade ape";
  if (sourceFormat === "legacy") return "Legado";
  return "Contrato 2.0";
}

function listDirection(list: GlobalImportList, packageValue: GlobalImportPackage): string | null {
  const metadata = list.cards[0]?.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const front = metadata.front_language;
    const back = metadata.back_language;
    if (typeof front === "string" && typeof back === "string") return `${front} → ${back}`;
  }
  const front = packageValue.package.source_language;
  const back = packageValue.package.target_language;
  return front && back ? `${front} → ${back}` : null;
}

export function GlobalImportValidationPreview(props: Props) {
  const errors = props.validation.issues.filter((issue) => issue.severity === "error");
  const warnings = props.validation.issues.filter((issue) => issue.severity === "warning");
  const smart = props.validation.smartPackage ? summarizeSmartImport(props.validation.smartPackage) : null;

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{props.counts.folders} pasta(s)</Badge>
          <Badge variant="outline">{props.counts.lists} lista(s)</Badge>
          <Badge variant="outline">{props.counts.cards} unidade(s) jogável(is)</Badge>
          {smart && <Badge variant="outline">{smart.normalCards} card(s) normal(is)</Badge>}
          {smart && smart.layeredGroups > 0 && <Badge variant="secondary">{smart.layeredGroups} grupo(s) em camadas</Badge>}
          {smart && smart.glossaryEntries > 0 && <Badge variant="secondary">{smart.glossaryEntries} entrada(s) de glossário</Badge>}
          {smart && smart.wordHints > 0 && <Badge variant="secondary">{smart.wordHints} dica(s) contextual(is)</Badge>}
          {smart && smart.detailedCards > 0 && <Badge variant="secondary">{smart.detailedCards} card(s) detalhado(s)</Badge>}
          <Badge variant="outline">{sourceLabel(props.validation.sourceFormat)}</Badge>
          {errors.length || props.destinationErrors.length
            ? <Badge variant="destructive">Revisão necessária</Badge>
            : <Badge>Estrutura válida</Badge>}
          {warnings.length ? <Badge variant="secondary">{warnings.length} aviso(s)</Badge> : null}
        </div>
        {smart && smart.layeredGroups > 0 && (
          <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            A contagem principal representa unidades jogáveis: cards normais valem 1 e cada camada dentro de um grupo vale 1. Os grupos não serão achatados.
          </p>
        )}
        {[...props.notes, ...props.destinationWarnings].map((note) => (
          <p key={note} className="mt-2 text-xs text-muted-foreground">ℹ️ {note}</p>
        ))}
        {props.destinationErrors.map((error) => (
          <p key={error} className="mt-2 text-sm text-destructive">{error}</p>
        ))}
      </Card>

      {props.validation.issues.length > 0 && (
        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Validação</h2>
          <ScrollArea className="max-h-56">
            <div className="space-y-2 pr-3">
              {props.validation.issues.map((issue, index) => (
                <div key={`${issue.path}-${issue.code}-${index}`} className="rounded border p-3 text-sm">
                  <div className="font-mono text-xs text-muted-foreground">{issue.code} · {issue.path}</div>
                  <div>{issue.message}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}

      {props.packageValue && (
        <Card className="space-y-4 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <FolderTree className="h-4 w-4" />3. Prévia: {props.packageValue.package.name}
          </h2>
          <div className="space-y-3">
            {props.packageValue.package.folders.map((folder, folderIndex) => (
              <details key={`${folder.name}-${folderIndex}`} open className="rounded-lg border p-3">
                <summary className="cursor-pointer font-semibold">
                  {folder.name} — {folder.lists.reduce((sum, list) => sum + list.cards.length, 0)} unidades jogáveis
                </summary>
                <div className="mt-3 space-y-2 pl-3">
                  {folder.lists.map((list, listIndex) => {
                    const direction = listDirection(list, props.packageValue!);
                    return (
                      <details key={`${list.name}-${listIndex}`} className="rounded-md bg-muted/40 p-3">
                        <summary className="cursor-pointer">
                          {list.name}: {list.cards.length} unidades{direction ? ` · ${direction}` : ""}
                        </summary>
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {list.cards.slice(0, 10).map((card, cardIndex) => (
                            <div key={`${card.front}-${cardIndex}`}>{cardIndex + 1}. {card.front} → {card.back}</div>
                          ))}
                          {list.cards.length > 10 && <div>… mais {list.cards.length - 10} unidade(s)</div>}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
