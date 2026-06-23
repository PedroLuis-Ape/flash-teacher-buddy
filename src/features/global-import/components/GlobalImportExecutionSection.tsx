import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExistingListConflictPolicy, GlobalImportDestinationMode } from "../destinationModes";
import type { CardConflictPolicy, GlobalImportExecutionReport } from "../mappedService";

interface Props {
  enabled: boolean;
  count: number;
  mode: GlobalImportDestinationMode;
  listConflictPolicy: ExistingListConflictPolicy;
  cardConflict: CardConflictPolicy;
  onCardConflictChange: (policy: CardConflictPolicy) => void;
  busy: boolean;
  progress: number;
  progressText: string;
  destinationErrors: string[];
  onImport: () => void;
  report: GlobalImportExecutionReport | null;
  undoing: boolean;
  onUndo: () => void;
  onOpenFolders: () => void;
  openLabel?: string;
}

export function GlobalImportExecutionSection(props: Props) {
  return (
    <>
      {props.enabled && !props.report && (
        <Card className="space-y-4 p-5">
          <div>
            <Label>Quando o mesmo card já existir na lista escolhida</Label>
            <Select value={props.cardConflict} onValueChange={(value) => props.onCardConflictChange(value as CardConflictPolicy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Ignorar o duplicado</SelectItem>
                <SelectItem value="copy">Criar outra cópia</SelectItem>
                <SelectItem value="error">Cancelar toda a importação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {props.mode === "existing-folder" && props.listConflictPolicy === "replace" && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              A opção substituir remove os cards atuais das listas conflitantes dentro da mesma transação. O botão de desfazer restaura o conteúdo anterior.
            </p>
          )}
          {props.busy && (
            <div className="space-y-2">
              <p className="text-sm">{props.progressText}</p>
              <Progress value={props.progress} />
            </div>
          )}
          <Button className="h-12 w-full" onClick={props.onImport} disabled={props.busy || props.destinationErrors.length > 0}>
            {props.busy
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</>
              : `Importar ${props.count} cards`}
          </Button>
        </Card>
      )}

      {props.report && (
        <Card className="border-primary/30 p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <CheckCircle2 className="h-5 w-5 text-primary" />Importação concluída
          </h2>
          <p className="mt-1 text-muted-foreground">Pacote: {props.report.package_name}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {props.report.assignments_created !== undefined && (
              <Metric value={props.report.assignments_created} label="Atribuições criadas" />
            )}
            <Metric value={props.report.folders_created} label="Pastas criadas" />
            <Metric value={props.report.lists_created} label="Listas criadas" />
            <Metric value={props.report.lists_replaced ?? 0} label="Listas substituídas" />
            <Metric value={props.report.lists_skipped ?? 0} label="Listas ignoradas" />
            <Metric value={props.report.cards_created} label="Cards criados" />
            <Metric value={props.report.cards_skipped} label="Cards duplicados ignorados" />
            <Metric value={props.report.glossary_created ?? 0} label="Glossário criado" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={props.onOpenFolders}>{props.openLabel ?? "Abrir minhas pastas"}</Button>
            <Button variant="outline" onClick={props.onUndo} disabled={props.undoing}>
              {props.undoing
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <RotateCcw className="mr-2 h-4 w-4" />}
              Desfazer esta importação
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
