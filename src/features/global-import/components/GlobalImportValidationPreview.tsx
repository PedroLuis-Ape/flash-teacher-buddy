import { AlertTriangle, FolderTree, Wrench } from "lucide-react";
import { summarizeSmartImport } from "@/features/smart-import/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GlobalImportList, GlobalImportPackage } from "../schema";
import { isSuperImportTestRolloutEnabled } from "../testRollout";
import type { GlobalImportIssue, GlobalImportV2ValidationResult } from "../validation";

interface Props {
  validation: GlobalImportV2ValidationResult;
  packageValue: GlobalImportPackage | null;
  counts: { folders: number; lists: number; cards: number };
  notes: string[];
  destinationErrors: string[];
  destinationWarnings: string[];
}

interface GroupedIssue {
  key: string;
  code: string;
  message: string;
  severity: GlobalImportIssue["severity"];
  paths: string[];
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

function groupIssues(issues: GlobalImportIssue[]): GroupedIssue[] {
  const groups = new Map<string, GroupedIssue>();
  issues.forEach((issue) => {
    const key = `${issue.severity}|${issue.code}|${issue.message}`;
    const current = groups.get(key);
    if (current) current.paths.push(issue.path);
    else groups.set(key, {
      key,
      code: issue.code,
      message: issue.message,
      severity: issue.severity,
      paths: [issue.path],
    });
  });
  return [...groups.values()].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
    return b.paths.length - a.paths.length;
  });
}

export function GlobalImportValidationPreview(props: Props) {
  const testRollout = isSuperImportTestRolloutEnabled();
  const errors = props.validation.issues.filter((issue) => issue.severity === "error");
  const warnings = props.validation.issues.filter((issue) => issue.severity === "warning");
  const smartPackage = props.validation.smartPackage;
  const smart = smartPackage ? summarizeSmartImport(smartPackage) : null;
  const groupedIssues = testRollout ? groupIssues(props.validation.issues) : [];
  const repairNotes = testRollout
    ? props.notes.filter((note) => note.toLowerCase().includes("correç"))
    : [];

  return (
    <>
      {repairNotes.length > 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-start gap-3">
            <Wrench className="mt-0.5 h-5 w-5 text-emerald-500" />
            <div>
              <h3 className="font-semibold">Correções automáticas aplicadas</h3>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {repairNotes.map((note) => <p key={note}>{note}</p>)}
              </div>
            </div>
          </div>
        </Card>
      )}

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
            Os grupos serão criados automaticamente. O card principal organiza o grupo e somente as camadas entram na contagem jogável.
          </p>
        )}
        {[...props.notes.filter((note) => !repairNotes.includes(note)), ...props.destinationWarnings].map((note) => (
          <p key={note} className="mt-2 text-xs text-muted-foreground">ℹ️ {note}</p>
        ))}
        {props.destinationErrors.map((error) => (
          <p key={error} className="mt-2 text-sm text-destructive">{error}</p>
        ))}
      </Card>

      {props.validation.issues.length > 0 && (
        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Validação</h2>
          {testRollout && errors.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Erros iguais foram agrupados. Corrija o tipo de problema, não cada linha individualmente.
            </p>
          )}
          <ScrollArea className="max-h-72">
            <div className="space-y-2 pr-3">
              {testRollout
                ? groupedIssues.map((group) => (
                    <div key={group.key} className="rounded border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={group.severity === "error" ? "destructive" : "secondary"}>
                          {group.severity === "error" ? "Erro" : "Aviso"}
                        </Badge>
                        <Badge variant="outline">{group.paths.length} ocorrência(s)</Badge>
                        <span className="font-mono text-xs text-muted-foreground">{group.code}</span>
                      </div>
                      <div className="mt-2 font-medium">{group.message}</div>
                      <div className="mt-2 rounded bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
                        {group.paths.slice(0, 3).map((path) => <div key={path}>{path}</div>)}
                        {group.paths.length > 3 && <div>… e mais {group.paths.length - 3} caminho(s)</div>}
                      </div>
                    </div>
                  ))
                : props.validation.issues.map((issue, index) => (
                    <div key={`${issue.path}-${issue.code}-${index}`} className="rounded border p-3 text-sm">
                      <div className="font-mono text-xs text-muted-foreground">{issue.code} · {issue.path}</div>
                      <div>{issue.message}</div>
                    </div>
                  ))}
            </div>
          </ScrollArea>
        </Card>
      )}

      {smartPackage ? (
        <Card className="space-y-4 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <FolderTree className="h-4 w-4" />Prévia recebida: {smartPackage.package.name}
          </h2>
          <div className="space-y-3">
            {smartPackage.package.folders.map((folder, folderIndex) => {
              const folderPlayable = folder.lists.reduce(
                (total, list) => total + list.cards.reduce(
                  (listTotal, card) => listTotal + (card.type === "normal" ? 1 : card.layers.length),
                  0,
                ),
                0,
              );
              return (
                <details key={`${folder.name}-${folderIndex}`} open className="rounded-lg border p-3">
                  <summary className="cursor-pointer font-semibold">
                    {folder.name} — {folderPlayable} unidades jogáveis
                  </summary>
                  <div className="mt-3 space-y-2 pl-3">
                    {folder.lists.map((list, listIndex) => {
                      const playable = list.cards.reduce(
                        (total, card) => total + (card.type === "normal" ? 1 : card.layers.length),
                        0,
                      );
                      return (
                        <details key={`${list.name}-${listIndex}`} className="rounded-md bg-muted/40 p-3">
                          <summary className="cursor-pointer">
                            {list.name}: {playable} unidades · {list.front_language} → {list.back_language}
                          </summary>
                          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                            {list.cards.slice(0, 10).map((card, cardIndex) => card.type === "normal" ? (
                              <div key={`${card.front}-${cardIndex}`}>📝 {card.front} → {card.back}</div>
                            ) : (
                              <details key={`${card.group_title}-${cardIndex}`} className="rounded border bg-background/60 p-2">
                                <summary className="cursor-pointer font-medium text-foreground">
                                  🗂️ {card.group_title} — {card.layers.length} camadas
                                </summary>
                                <div className="mt-2 space-y-1 pl-4">
                                  {card.layers.map((layer, layerIndex) => (
                                    <div key={`${layer.front}-${layer.back}-${layerIndex}`}>
                                      {layerIndex + 1}. {layer.front} → {layer.back}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            ))}
                            {list.cards.length > 10 && <div>… mais {list.cards.length - 10} item(ns) estrutural(is)</div>}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        </Card>
      ) : props.packageValue ? (
        <Card className="space-y-4 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <FolderTree className="h-4 w-4" />Prévia recebida: {props.packageValue.package.name}
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
      ) : null}
    </>
  );
}
