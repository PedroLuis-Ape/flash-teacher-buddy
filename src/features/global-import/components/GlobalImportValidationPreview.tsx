import { AlertTriangle, FolderTree } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GlobalImportPackage } from "../schema";
import type { GlobalImportV2ValidationResult } from "../validation";

interface Props {
  validation: GlobalImportV2ValidationResult;
  packageValue: GlobalImportPackage | null;
  counts: { folders: number; lists: number; cards: number };
  notes: string[];
  destinationErrors: string[];
  destinationWarnings: string[];
}

export function GlobalImportValidationPreview(props: Props) {
  const errors = props.validation.issues.filter((issue) => issue.severity === "error");
  const warnings = props.validation.issues.filter((issue) => issue.severity === "warning");
  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{props.counts.folders} pasta(s)</Badge>
          <Badge variant="outline">{props.counts.lists} lista(s)</Badge>
          <Badge variant="outline">{props.counts.cards} card(s)</Badge>
          <Badge variant="outline">{props.validation.sourceFormat === "canonical" ? "Canônico" : "Legado"}</Badge>
          {errors.length || props.destinationErrors.length
            ? <Badge variant="destructive">Revisão necessária</Badge>
            : <Badge>Estrutura válida</Badge>}
          {warnings.length ? <Badge variant="secondary">{warnings.length} aviso(s)</Badge> : null}
        </div>
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
                  <div className="font-mono text-xs text-muted-foreground">{issue.path}</div>
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
                  {folder.name} — {folder.lists.reduce((sum, list) => sum + list.cards.length, 0)} cards
                </summary>
                <div className="mt-3 space-y-2 pl-3">
                  {folder.lists.map((list, listIndex) => (
                    <details key={`${list.name}-${listIndex}`} className="rounded-md bg-muted/40 p-3">
                      <summary className="cursor-pointer">{list.name}: {list.cards.length} cards</summary>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {list.cards.slice(0, 10).map((card, cardIndex) => (
                          <div key={`${card.front}-${cardIndex}`}>{cardIndex + 1}. {card.front} → {card.back}</div>
                        ))}
                        {list.cards.length > 10 && <div>… mais {list.cards.length - 10} card(s)</div>}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
