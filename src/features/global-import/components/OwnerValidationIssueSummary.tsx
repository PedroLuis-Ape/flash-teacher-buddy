import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { GlobalImportIssue, GlobalImportV2ValidationResult } from "../validation";

interface Props {
  validation: GlobalImportV2ValidationResult;
  notes: string[];
}

interface GroupedIssue {
  key: string;
  code: string;
  message: string;
  severity: GlobalImportIssue["severity"];
  paths: string[];
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

export function OwnerValidationIssueSummary({ validation, notes }: Props) {
  const grouped = groupIssues(validation.issues);
  const errors = validation.issues.filter((issue) => issue.severity === "error").length;
  const warnings = validation.issues.length - errors;
  const repairNotes = notes.filter((note) => note.toLowerCase().includes("correç") || note.includes("convertido"));

  return (
    <div className="space-y-4">
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

      <Card className={`p-5 ${errors ? "border-destructive/40" : "border-emerald-500/30"}`}>
        <div className="flex flex-wrap items-center gap-2">
          {errors
            ? <AlertTriangle className="h-5 w-5 text-destructive" />
            : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          <h3 className="font-semibold">{errors ? "O JSON ainda precisa de correção" : "JSON validado"}</h3>
          {errors > 0 && <Badge variant="destructive">{errors} erro(s)</Badge>}
          {warnings > 0 && <Badge variant="secondary">{warnings} aviso(s)</Badge>}
        </div>
        {errors > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Problemas repetidos foram agrupados para mostrar o que realmente precisa ser corrigido.
          </p>
        )}
      </Card>

      {grouped.map((group) => (
        <Card key={group.key} className="p-4">
          <div className="flex flex-wrap items-start gap-2">
            <Badge variant={group.severity === "error" ? "destructive" : "secondary"}>
              {group.severity === "error" ? "Erro" : "Aviso"}
            </Badge>
            <Badge variant="outline">{group.paths.length} ocorrência(s)</Badge>
            <span className="font-mono text-xs text-muted-foreground">{group.code}</span>
          </div>
          <p className="mt-3 text-sm font-medium">{group.message}</p>
          <div className="mt-3 rounded-lg bg-muted/40 p-3 font-mono text-xs text-muted-foreground">
            {group.paths.slice(0, 3).map((path) => <div key={path}>{path}</div>)}
            {group.paths.length > 3 && <div>… e mais {group.paths.length - 3} caminho(s)</div>}
          </div>
        </Card>
      ))}
    </div>
  );
}
