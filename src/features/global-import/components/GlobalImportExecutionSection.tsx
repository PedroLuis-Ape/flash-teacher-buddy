import { CheckCircle2, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExistingListConflictPolicy, GlobalImportDestinationMode } from "../destinationModes";
import type { CardConflictPolicy, GlobalImportExecutionReport } from "../mappedService";

interface Props {
  enabled: boolean;
  count: number;
  mode: GlobalImportDestinationMode;
  listConflictPolicy?: ExistingListConflictPolicy;
  replacementListNames?: string[];
  replacementConfirmed?: boolean;
  onReplacementConfirmedChange?: (confirmed: boolean) => void;
  cardConflict: CardConflictPolicy;
  onCardConflictChange: (policy: CardConflictPolicy) => void;
  busy: boolean;
  progress: number;
  progressText: string;
  destinationErrors: string[];
  disabledReason?: string | null;
  stickyAction?: boolean;
  onImport: () => void;
  report: GlobalImportExecutionReport | null;
  undoing: boolean;
  onUndo: () => void;
  onOpenFolders: () => void;
  openLabel?: string;
  /**
   * Ação opcional de reset pré-importação. Quando fornecida, o relatório
   * exibe um botão para limpar os estados locais e preparar outro lote sem
   * recarregar a tela nem alterar o executor transacional.
   */
  onPrepareNewImport?: () => void;
}

export function GlobalImportExecutionSection(props: Props) {
  const requiresReplacementConfirmation = (props.replacementListNames?.length ?? 0) > 0;
  const replacementConfirmationMissing = requiresReplacementConfirmation && !props.replacementConfirmed;
  const blockingReason = props.destinationErrors[0]
    ?? (replacementConfirmationMissing
      ? "Confirme a substituição das listas antes de iniciar."
      : !props.enabled
        ? props.disabledReason ?? "A preparação da importação ainda não terminou."
        : null);
  const actionDisabled = !props.enabled
    || props.busy
    || props.destinationErrors.length > 0
    || replacementConfirmationMissing;
  const actionButton = (
    <Button
      type="button"
      className="h-12 w-full min-w-0 pointer-events-auto sm:w-auto sm:min-w-72"
      onClick={props.onImport}
      disabled={actionDisabled}
      aria-describedby={blockingReason
        ? props.stickyAction
          ? "super-import-dock-blocking-reason"
          : "super-import-blocking-reason"
        : undefined}
    >
      {props.busy
        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</>
        : `Confirmar e importar ${props.count} cards`}
    </Button>
  );

  return (
    <div
      data-super-import-status={props.report ? "success" : props.busy ? "running" : props.enabled ? "ready" : "blocked"}
      className="relative z-10 isolate pointer-events-auto"
    >
      {!props.report && (
        <Card className="space-y-4 p-5 pointer-events-auto">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">4. Confirme a importação</h2>
              <p className="text-sm text-muted-foreground">
                Esta é a única etapa que grava dados no banco.
              </p>
            </div>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-900 dark:text-amber-100">
              Ainda não importado
            </span>
          </div>

          <details className="rounded-lg border bg-muted/20">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
              Duplicados: {
                props.cardConflict === "skip"
                  ? "ignorar cards repetidos"
                  : props.cardConflict === "replace"
                    ? "atualizar cards existentes"
                    : props.cardConflict === "copy"
                      ? "manter outra cópia"
                      : "bloquear o lote"
              }
            </summary>
            <div className="space-y-3 border-t p-3">
              <div>
                <Label>Quando o mesmo card já existir na lista escolhida</Label>
                <Select value={props.cardConflict} onValueChange={(value) => props.onCardConflictChange(value as CardConflictPolicy)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Ignorar o duplicado</SelectItem>
                    <SelectItem value="replace">Atualizar o card existente</SelectItem>
                    <SelectItem value="copy">Criar outra cópia</SelectItem>
                    <SelectItem value="error">Bloquear o lote</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {props.cardConflict === "replace" && (
                <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  O conteúdo pedagógico do card existente será atualizado. O lote guarda uma cópia anterior para permitir desfazer.
                </p>
              )}
            </div>
          </details>

          {props.mode === "existing-folder" && props.listConflictPolicy === "replace" && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              A opção substituir remove os cards atuais das listas conflitantes dentro da mesma transação. O botão de desfazer restaura o conteúdo anterior.
            </p>
          )}
          {requiresReplacementConfirmation && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={props.replacementConfirmed}
                  onCheckedChange={(checked) => props.onReplacementConfirmedChange?.(checked === true)}
                  aria-describedby="replace-confirmation-description"
                />
                <span id="replace-confirmation-description">
                  Confirmo que desejo substituir o conteúdo de{" "}
                  {props.replacementListNames?.map((name) => `“${name}”`).join(", ")}.
                  Poderei desfazer o lote após a importação.
                </span>
              </label>
            </div>
          )}
          {blockingReason && (
            <p
              id="super-import-blocking-reason"
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              role="alert"
            >
              {blockingReason}
            </p>
          )}
          {props.busy && (
            <div className="space-y-2" aria-live="polite">
              <p className="text-sm">{props.progressText}</p>
              <Progress value={props.progress} />
            </div>
          )}
          {!props.stickyAction && actionButton}
        </Card>
      )}

      {props.report && (
        <Card className="super-import-success relative z-20 border-primary/30 p-6 pointer-events-auto">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <CheckCircle2 className="h-5 w-5 text-primary" />Importação concluída
          </h2>
          <p className="mt-1 text-muted-foreground">Pacote: {props.report.package_name}</p>
          <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            Processo finalizado. Os dados já foram gravados e não existe outra etapa pendente de confirmação.
          </p>
          {props.report.glossary_warning && (
            <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100" role="status">
              {props.report.glossary_warning}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {props.report.assignments_created !== undefined && (
              <Metric value={props.report.assignments_created} label="Atribuições criadas" />
            )}
            <Metric value={props.report.folders_created} label="Pastas criadas" />
            <Metric value={props.report.lists_created} label="Listas criadas" />
            <Metric value={props.report.lists_replaced ?? 0} label="Listas substituídas" />
            <Metric value={props.report.lists_skipped ?? 0} label="Listas ignoradas" />
            <Metric value={props.report.cards_created} label="Cards criados" />
            <Metric value={props.report.cards_updated ?? 0} label="Cards atualizados" />
            <Metric value={props.report.cards_skipped} label="Cards duplicados ignorados" />
            <Metric value={props.report.glossary_created ?? 0} label="Glossário criado" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2 pointer-events-auto">
            <Button type="button" className="pointer-events-auto" onClick={props.onOpenFolders}>{props.openLabel ?? "Abrir minhas pastas"}</Button>
            <Button type="button" variant="outline" className="pointer-events-auto" onClick={props.onUndo} disabled={props.undoing}>
              {props.undoing
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <RotateCcw className="mr-2 h-4 w-4" />}
              Desfazer esta importação
            </Button>
            {props.onPrepareNewImport && (
              <Button
                type="button"
                variant="secondary"
                className="pointer-events-auto"
                onClick={props.onPrepareNewImport}
                disabled={props.undoing || props.busy}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Preparar nova importação
              </Button>
            )}
          </div>
        </Card>
      )}

      {props.stickyAction && !props.report && typeof document !== "undefined" && createPortal(
        <div
          data-super-import-confirmation-dock="true"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[2147483000] border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_35px_rgba(0,0,0,0.28)] backdrop-blur"
          role="region"
          aria-label="Confirmação da importação"
        >
          <div className="pointer-events-auto mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0" aria-live="polite">
              <p className="font-semibold">
                {props.busy ? "Importação em andamento" : "Ainda não importado"}
              </p>
              <p
                id={blockingReason ? "super-import-dock-blocking-reason" : undefined}
                className={blockingReason ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
              >
                {blockingReason ?? `${props.count} cards preparados. Revise e confirme para gravar.`}
              </p>
            </div>
            {actionButton}
          </div>
        </div>,
        document.body,
      )}
    </div>
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
