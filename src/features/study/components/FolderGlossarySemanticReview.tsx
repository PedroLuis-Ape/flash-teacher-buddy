import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Download,
  Eye,
  FileUp,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { FolderGlossaryCoverageReport } from "@/features/study/lib/folderGlossaryCoverage";
import type {
  FolderGlossaryEntry,
  FolderGlossaryInput,
} from "@/features/study/lib/folderGlossaryTypes";
import {
  getImportableSemanticEntries,
  parseSemanticReviewCompletionJson,
  serializeSemanticReviewRequest,
  type SemanticReviewEntry,
  type SemanticReviewResult,
  type SemanticReviewStatus,
} from "@/features/study/lib/folderGlossarySemanticReview";

interface Props {
  folderId: string;
  folderTitle: string;
  labelA: string;
  labelB: string;
  report: FolderGlossaryCoverageReport;
  glossary: FolderGlossaryEntry[];
  isImporting: boolean;
  onImportEntries: (entries: FolderGlossaryInput[]) => Promise<unknown>;
}

const semanticStatusLabels: Record<SemanticReviewStatus, string> = {
  approved: "Aprovada",
  approved_with_warning: "Aprovada com ressalva",
  requires_human_review: "Revisão humana",
  conflicting_senses: "Conflito de sentidos",
  incorrect: "Incorreta",
};

const semanticStatusClasses: Record<SemanticReviewStatus, string> = {
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  approved_with_warning: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  requires_human_review: "border-orange-500/30 bg-orange-500/10 text-orange-600",
  conflicting_senses: "border-violet-500/30 bg-violet-500/10 text-violet-600",
  incorrect: "border-destructive/30 bg-destructive/10 text-destructive",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "pasta";
}

function downloadJson(content: string, fileName: string) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function confidenceLabel(value: number) {
  return `${Math.round(value * 100)}%`;
}

function SemanticEntryCard({
  entry,
  warningSelected,
  onWarningSelected,
}: {
  entry: SemanticReviewEntry;
  warningSelected: boolean;
  onWarningSelected: (selected: boolean) => void;
}) {
  const changed = entry.proposal_changed;
  const isWarning = entry.review_status === "approved_with_warning";

  return (
    <article className="space-y-3 rounded-xl border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="break-words">{entry.term}</strong>
            <Badge variant="outline" className="text-[10px]">
              {entry.side} · {entry.entry_kind === "word" ? "palavra" : "expressão"}
            </Badge>
            <Badge variant="outline" className={semanticStatusClasses[entry.review_status]}>
              {semanticStatusLabels[entry.review_status]}
            </Badge>
            {changed && <Badge variant="secondary">Correção proposta</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Confiança semântica: {confidenceLabel(entry.semantic_confidence)} · {entry.part_of_speech} · {entry.grammatical_form}
          </p>
        </div>

        {isWarning && changed && (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={warningSelected}
              onChange={(event) => onWarningSelected(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Confirmar ressalva
          </label>
        )}
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-muted/35 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Tradução atual
          </p>
          <p className="mt-1 break-words font-medium">{entry.current_translation}</p>
        </div>
        <div className="rounded-lg bg-primary/5 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Proposta revisada
          </p>
          <p className="mt-1 break-words font-medium">{entry.translation}</p>
        </div>
      </div>

      <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        <p><span className="font-medium text-foreground">Contexto:</span> {entry.context_summary}</p>
        <p><span className="font-medium text-foreground">Justificativa:</span> {entry.review_reason}</p>
        {entry.issues.length > 0 && (
          <p><span className="font-medium text-foreground">Alertas:</span> {entry.issues.join(", ")}</p>
        )}
        {entry.examples[entry.evidence_examples[0] ?? -1] && (
          <div className="rounded-lg border border-dashed p-3">
            <p className="font-medium text-foreground">Exemplo de evidência</p>
            <p className="mt-1">{entry.examples[entry.evidence_examples[0]].text}</p>
          </div>
        )}
      </div>
    </article>
  );
}

export function FolderGlossarySemanticReview({
  folderId,
  folderTitle,
  labelA,
  labelB,
  report,
  glossary,
  isImporting,
  onImportEntries,
}: Props) {
  const semanticFileInputRef = useRef<HTMLInputElement>(null);
  const [review, setReview] = useState<SemanticReviewResult | null>(null);
  const [showPending, setShowPending] = useState(false);
  const [selectedWarningKeys, setSelectedWarningKeys] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState<"approved" | "warnings" | null>(null);

  const structuralComplete = report.distinctTerms > 0
    && report.coveredTerms === report.distinctTerms;

  useEffect(() => {
    setReview(null);
    setShowPending(false);
    setSelectedWarningKeys(new Set());
  }, [report.generatedAt, glossary]);

  const pendingEntries = useMemo(
    () => review?.entries.filter((entry) => entry.review_status !== "approved") ?? [],
    [review],
  );

  const changedApprovedEntries = useMemo(
    () => review?.entries.filter(
      (entry) => entry.review_status === "approved" && entry.proposal_changed,
    ) ?? [],
    [review],
  );

  const changedWarningEntries = useMemo(
    () => review?.entries.filter(
      (entry) => entry.review_status === "approved_with_warning" && entry.proposal_changed,
    ) ?? [],
    [review],
  );

  const semanticContext = {
    folderId,
    folderTitle,
    labelA,
    labelB,
    report,
    glossary,
  };

  const exportSemanticReview = () => {
    try {
      const content = serializeSemanticReviewRequest(semanticContext);
      downloadJson(
        content,
        `app-piteco-revisao-semantica-${slugify(folderTitle)}.json`,
      );
      toast.success("Revisão semântica exportada com o prompt completo e as evidências dos cards.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível exportar a revisão semântica.");
    }
  };

  const importSemanticReview = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLocaleLowerCase().endsWith(".json") && file.type !== "application/json") {
      toast.error("Selecione um arquivo .json.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("O arquivo excede 25 MB.");
      return;
    }

    try {
      const parsed = parseSemanticReviewCompletionJson(await file.text(), semanticContext);
      setReview(parsed);
      setShowPending(parsed.summary.pending > 0);
      setSelectedWarningKeys(new Set());
      toast.success(
        `Revisão validada: ${parsed.summary.approved.toLocaleString("pt-BR")} aprovada(s) e ${parsed.summary.pending.toLocaleString("pt-BR")} pendente(s). Nenhuma alteração foi gravada ainda.`,
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível validar a revisão semântica.");
    }
  };

  const applyApproved = async () => {
    if (!review || applying || isImporting) return;
    const entries = getImportableSemanticEntries(review, {
      includeApproved: true,
      changedOnly: true,
    });
    if (entries.length === 0) {
      toast.info("As traduções aprovadas já correspondem ao glossário atual. Nada precisa ser gravado.");
      return;
    }

    setApplying("approved");
    try {
      await onImportEntries(entries);
      toast.success(`${entries.length.toLocaleString("pt-BR")} correção(ões) semântica(s) aprovada(s) aplicada(s).`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível aplicar as correções aprovadas.");
    } finally {
      setApplying(null);
    }
  };

  const applyConfirmedWarnings = async () => {
    if (!review || applying || isImporting) return;
    if (selectedWarningKeys.size === 0) {
      toast.error("Selecione ao menos uma ressalva para confirmar manualmente.");
      return;
    }

    const entries = getImportableSemanticEntries(review, {
      includeApproved: false,
      confirmedWarningKeys: selectedWarningKeys,
      changedOnly: true,
    });
    if (entries.length === 0) {
      toast.info("As ressalvas selecionadas não possuem correções novas para gravar.");
      return;
    }

    setApplying("warnings");
    try {
      await onImportEntries(entries);
      toast.success(`${entries.length.toLocaleString("pt-BR")} ressalva(s) confirmada(s) aplicada(s).`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível aplicar as ressalvas confirmadas.");
    } finally {
      setApplying(null);
    }
  };

  const setWarningSelected = (entryKey: string, selected: boolean) => {
    setSelectedWarningKeys((current) => {
      const next = new Set(current);
      if (selected) next.add(entryKey);
      else next.delete(entryKey);
      return next;
    });
  };

  return (
    <section className="space-y-4 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
          <div>
            <p className="font-semibold">Qualidade semântica das traduções</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Uma segunda IA revisa contexto, classe gramatical, flexão, naturalidade, falsos cognatos e conflitos de sentido. Importar o arquivo apenas valida a revisão; a gravação acontece somente nos botões de aplicação.
            </p>
          </div>
        </div>
        {review?.summary.complete && (
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />Qualidade semântica completa
          </Badge>
        )}
      </div>

      {!structuralComplete ? (
        <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-muted-foreground">
            Complete primeiro a cobertura estrutural exata. A revisão semântica só pode começar quando cada palavra possuir uma entrada individual ativa no lado correto.
          </p>
        </div>
      ) : review ? (
        <>
          <div className="space-y-3 rounded-xl border bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Qualidade semântica: {review.summary.qualityLabel}%</p>
                <p className="text-sm text-muted-foreground">
                  {review.summary.approved.toLocaleString("pt-BR")} de {review.summary.total.toLocaleString("pt-BR")} entradas foram aprovadas sem ressalva
                </p>
              </div>
              <Badge variant="outline">
                {review.summary.words.toLocaleString("pt-BR")} palavras · {review.summary.expressions.toLocaleString("pt-BR")} expressões
              </Badge>
            </div>
            <Progress value={review.summary.qualityPercent} className="h-2" />
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={semanticStatusClasses.approved}>{review.summary.approved} aprovadas</Badge>
              <Badge variant="outline" className={semanticStatusClasses.approved_with_warning}>{review.summary.approvedWithWarning} com ressalva</Badge>
              <Badge variant="outline" className={semanticStatusClasses.requires_human_review}>{review.summary.requiresHumanReview} revisão humana</Badge>
              <Badge variant="outline" className={semanticStatusClasses.conflicting_senses}>{review.summary.conflictingSenses} conflitos</Badge>
              <Badge variant="outline" className={semanticStatusClasses.incorrect}>{review.summary.incorrect} incorretas</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void applyApproved()}
              disabled={isImporting || applying !== null || changedApprovedEntries.length === 0}
            >
              {applying === "approved"
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Aplicar correções aprovadas ({changedApprovedEntries.length})
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void applyConfirmedWarnings()}
              disabled={isImporting || applying !== null || selectedWarningKeys.size === 0}
            >
              {applying === "warnings"
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <AlertTriangle className="mr-2 h-4 w-4" />}
              Aplicar ressalvas confirmadas ({selectedWarningKeys.size})
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowPending((current) => !current)}
              disabled={pendingEntries.length === 0}
            >
              <Eye className="mr-2 h-4 w-4" />
              Ver pendências semânticas ({pendingEntries.length})
            </Button>
          </div>

          {showPending && (
            <div className="space-y-3">
              {pendingEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                  Nenhuma pendência semântica.
                </div>
              ) : pendingEntries.map((entry) => (
                <SemanticEntryCard
                  key={entry.entry_key}
                  entry={entry}
                  warningSelected={selectedWarningKeys.has(entry.entry_key)}
                  onWarningSelected={(selected) => setWarningSelected(entry.entry_key, selected)}
                />
              ))}
            </div>
          )}

          {changedWarningEntries.length > 0 && !showPending && (
            <p className="text-xs text-muted-foreground">
              Existem {changedWarningEntries.length.toLocaleString("pt-BR")} proposta(s) com ressalva. Abra as pendências para revisar e confirmar individualmente.
            </p>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed bg-background/50 p-4 text-sm text-muted-foreground">
          Qualidade semântica: não revisada. Exporte o pacote, envie-o a uma IA revisora independente e importe o JSON devolvido. Nenhuma integração externa é executada automaticamente pelo aplicativo.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={exportSemanticReview}
          disabled={!structuralComplete || glossary.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar para revisão semântica
        </Button>
        <input
          ref={semanticFileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            void importSemanticReview(file);
            event.currentTarget.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => semanticFileInputRef.current?.click()}
          disabled={!structuralComplete || isImporting || applying !== null}
        >
          <FileUp className="mr-2 h-4 w-4" />
          Importar revisão semântica
        </Button>
      </div>
    </section>
  );
}
