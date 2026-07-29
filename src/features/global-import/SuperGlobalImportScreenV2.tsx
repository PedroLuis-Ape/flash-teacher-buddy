import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useInstitution } from "@/contexts/InstitutionContext";
import { BulkGlossaryImportPanel } from "./components/BulkGlossaryImportPanel";
import { DestinationMappingCard } from "./components/DestinationMappingCard";
import { GlobalImportDestinationSection } from "./components/GlobalImportDestinationSection";
import { GlobalImportDestinationSummary } from "./components/GlobalImportDestinationSummary";
import { GlobalImportExecutionSection } from "./components/GlobalImportExecutionSection";
import { GlobalImportJsonSection } from "./components/GlobalImportJsonSection";
import { GlobalImportValidationPreview } from "./components/GlobalImportValidationPreview";
import { PromptBuilderCard } from "./components/PromptBuilderCard";
import {
  capabilityLabel,
  evaluateImportCapabilities,
  fetchImportCapabilities,
  requirementsForPackage,
} from "@/features/import-capabilities/capabilities";
import { ImportCapabilitiesPanel } from "@/features/import-capabilities/ImportCapabilitiesPanel";
import { useImportCapabilities } from "@/features/import-capabilities/useImportCapabilities";
import {
  loadImportDestinationCatalog,
  validateDestinationPlan,
  type GlobalImportDestinationPlan,
  type ImportDestinationCatalog,
  type ImportDestinationContext,
} from "./destination";
import {
  prepareGlobalImportDestination,
  type GlobalImportDestinationMode,
} from "./destinationModes";
import { summarizeDestinationPlan } from "./destinationSummary";
import { updateGlobalImportManifestStatus } from "./manifest";
import {
  executeMappedGlobalImport,
  undoGlobalImport,
  type CardConflictPolicy,
  type GlobalImportExecutionReport,
} from "./mappedService";
import type { GlobalImportPackage } from "./schema";
import { useGlobalImportSource } from "./useGlobalImportSource";
import type { GlobalImportV2ValidationResult } from "./validation";

function packageCounts(packageValue: GlobalImportPackage | null) {
  if (!packageValue) return { folders: 0, lists: 0, cards: 0 };
  return packageValue.package.folders.reduce(
    (totals, folder) => ({
      folders: totals.folders + 1,
      lists: totals.lists + folder.lists.length,
      cards: totals.cards + folder.lists.reduce((sum, list) => sum + list.cards.length, 0),
    }),
    { folders: 0, lists: 0, cards: 0 },
  );
}

export default function SuperGlobalImportScreenV2() {
  const navigate = useNavigate();
  const { turmaId } = useParams<{ turmaId?: string }>();
  const classroomMode = Boolean(turmaId);
  const { userId } = useAuth();
  const { selectedInstitution } = useInstitution();
  const institutionId = classroomMode ? null : selectedInstitution?.id ?? null;
  const destinationContext = useMemo<ImportDestinationContext>(
    () => classroomMode && turmaId
      ? { scope: "classroom", turmaId }
      : { scope: "personal", institutionId },
    [classroomMode, institutionId, turmaId],
  );
  const source = useGlobalImportSource();
  const capabilities = useImportCapabilities(true);
  const [destinationMode, setDestinationMode] = useState<GlobalImportDestinationMode>("from-file");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedListStrategy, setSelectedListStrategy] = useState<"append" | "replace">("append");
  const [newFolderName, setNewFolderName] = useState("");
  const [catalog, setCatalog] = useState<ImportDestinationCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [destinationPlan, setDestinationPlan] = useState<GlobalImportDestinationPlan | null>(null);
  const [replacementConfirmed, setReplacementConfirmed] = useState(false);
  const [cardConflict, setCardConflict] = useState<CardConflictPolicy>("skip");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [report, setReport] = useState<GlobalImportExecutionReport | null>(null);
  const [undoing, setUndoing] = useState(false);

  const reloadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    setCatalog(null);
    setSelectedFolderId("");
    setSelectedListId("");
    setSelectedListStrategy("append");
    setDestinationPlan(null);
    setReplacementConfirmed(false);
    try {
      setCatalog(await loadImportDestinationCatalog(destinationContext));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido.";
      setCatalogError(message);
      toast.error("Não foi possível carregar as pastas disponíveis.");
    } finally {
      setCatalogLoading(false);
    }
  }, [destinationContext]);

  useEffect(() => {
    void reloadCatalog();
  }, [reloadCatalog, userId]);

  const selectedFolder = catalog?.folders.find((folder) => folder.id === selectedFolderId);
  const selectedList = catalog?.lists.find(
    (list) => list.id === selectedListId && list.folder_id === selectedFolderId,
  );
  const destinationFolderName = destinationMode === "existing-folder"
    ? selectedFolder?.title
    : destinationMode === "new-folder"
      ? newFolderName
      : undefined;

  const prepared = useMemo(() => {
    if (!source.validation?.valid || !source.validation.package || !catalog) return null;
    return prepareGlobalImportDestination(source.validation.package, catalog, {
      mode: destinationMode,
      existingFolderId: selectedFolderId,
      existingListId: selectedList?.id,
      existingListStrategy: selectedListStrategy,
      newFolderName,
    });
  }, [
    source.validation,
    catalog,
    destinationMode,
    selectedFolderId,
    selectedList,
    selectedListStrategy,
    newFolderName,
  ]);

  useEffect(() => {
    setDestinationPlan(prepared?.plan ?? null);
    setReplacementConfirmed(false);
  }, [prepared]);

  const packageToPreview = prepared?.packageValue ?? source.validation?.package ?? null;
  const counts = packageCounts(packageToPreview);
  const planErrors = useMemo(
    () => packageToPreview && catalog && destinationPlan
      ? validateDestinationPlan(packageToPreview, catalog, destinationPlan)
      : [],
    [catalog, destinationPlan, packageToPreview],
  );
  const destinationErrors = Array.from(new Set([
    ...(prepared?.errors ?? []),
    ...planErrors,
  ]));
  const destinationWarnings = prepared?.warnings ?? [];
  const destinationSummary = useMemo(
    () => packageToPreview && catalog && destinationPlan
      ? summarizeDestinationPlan(packageToPreview, catalog, destinationPlan)
      : null,
    [catalog, destinationPlan, packageToPreview],
  );
  const capabilityRequirements = requirementsForPackage(source.validation?.smartPackage);
  const capabilityEvaluation = evaluateImportCapabilities(capabilities.data, capabilityRequirements);
  const executionEnabled = Boolean(
    capabilityEvaluation.ready
    && source.validation?.valid
    && packageToPreview
    && catalog
    && destinationPlan
    && !catalogLoading
  );
  const executionDisabledReason = !capabilityEvaluation.ready
    ? capabilityEvaluation.failedChecks[0]?.detail
      ?? (capabilityEvaluation.missing.length > 0
        ? `Recurso indisponível: ${capabilityEvaluation.missing.map(capabilityLabel).join(", ")}.`
        : "O diagnóstico do banco ainda não liberou esta importação.")
    : catalogLoading
      ? "Revalidando as pastas e listas de destino."
      : destinationErrors[0] ?? null;

  const prepareValidPackage = async (validation: GlobalImportV2ValidationResult) => {
    setReport(null);
    if (!validation.valid || !validation.package) {
      setDestinationPlan(null);
      toast.error("O pacote possui erros bloqueantes.");
      return;
    }
    if (validation.requestId) updateGlobalImportManifestStatus(validation.requestId, "validated");
    const nextCatalog = catalog ?? await loadImportDestinationCatalog(destinationContext);
    setCatalog(nextCatalog);
    toast.success("Pacote válido. Revise o destino e a prévia antes de importar.");
  };

  const handleAnalyze = async () => {
    if (!capabilityEvaluation.ready) {
      toast.error("O diagnóstico do banco ainda não permite iniciar a análise.");
      return;
    }
    try {
      await prepareValidPackage(source.analyze());
    } catch (error: any) {
      setDestinationPlan(null);
      toast.error(error?.message || "Não foi possível analisar o pacote.");
    }
  };

  const handleFile = async (file?: File) => {
    if (!capabilityEvaluation.ready) {
      toast.error("O diagnóstico do banco ainda não permite carregar este pacote.");
      return;
    }
    try {
      const result = await source.readFile(file);
      if (result) await prepareValidPackage(result.validation);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível ler o arquivo.");
    }
  };

  const handleRawChange = (value: string) => {
    source.reset(value);
    setDestinationPlan(null);
    setReport(null);
    setProgress(0);
    setProgressText("");
    setReplacementConfirmed(false);
  };

  const handleImport = async () => {
    const validation = source.validation;
    if (!validation?.valid || !validation.package || !catalog) return;
    if (classroomMode && !turmaId) return;

    const effectivePackage = packageToPreview;
    const effectivePlan = destinationPlan;

    if (destinationErrors.length) {
      toast.error(destinationErrors[0]);
      return;
    }
    if (!effectivePackage || !effectivePlan) {
      toast.error("Defina um destino válido antes de importar.");
      return;
    }
    if ((destinationSummary?.replacementListNames.length ?? 0) > 0 && !replacementConfirmed) {
      toast.error("Confirme explicitamente as substituições antes de importar.");
      return;
    }

    let latestCatalog: ImportDestinationCatalog;
    try {
      const latestCapabilities = await fetchImportCapabilities();
      const latestEvaluation = evaluateImportCapabilities(
        latestCapabilities,
        requirementsForPackage(validation.smartPackage),
      );
      if (!latestEvaluation.ready) {
        toast.error("O ambiente mudou e não suporta todos os dados deste pacote. A importação foi bloqueada.");
        return;
      }

      latestCatalog = await loadImportDestinationCatalog(destinationContext);
      const latestPlanErrors = validateDestinationPlan(effectivePackage, latestCatalog, effectivePlan);
      if (latestPlanErrors.length) {
        setCatalog(latestCatalog);
        toast.error(`O destino mudou desde a análise: ${latestPlanErrors[0]}`);
        return;
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error
        ? `Não foi possível revalidar o destino: ${error.message}`
        : "Não foi possível revalidar o destino.");
      return;
    }

    setBusy(true);
    setProgress(0);
    setProgressText("Preparando a importação...");
    try {
      const imported = await executeMappedGlobalImport(effectivePackage, {
        requestId: classroomMode ? undefined : validation.requestId ?? undefined,
        officialPackage: validation.officialPackage,
        canonicalPackage: validation.canonicalPackage,
        smartPackage: validation.smartPackage,
        destinationPlan: effectivePlan,
        catalog: latestCatalog,
        cardConflict,
        institutionId,
        turmaId: turmaId ?? null,
        onProgress: (completed, total, label) => {
          setProgress(total > 0 ? (completed / total) * 100 : 0);
          setProgressText(`${label} — ${completed}/${total}`);
        },
      });
      setReport(imported);
      setProgress(100);
      setProgressText("Concluído");
      toast.success(classroomMode
        ? "Lote importado e atribuído à turma."
        : "Importação global concluída.");
    } catch (error: any) {
      toast.error(error?.message || "A importação falhou e foi desfeita.");
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    if (!report?.batch_id) return;
    setUndoing(true);
    try {
      await undoGlobalImport(report.batch_id, classroomMode ? "classroom" : "personal");
      setReport(null);
      setProgress(0);
      setProgressText("");
      toast.success(classroomMode
        ? "O lote e suas atribuições foram removidos da turma."
        : "A importação foi desfeita.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível desfazer a importação.");
    } finally {
      setUndoing(false);
    }
  };

  const handleBack = () => {
    if (classroomMode && turmaId) navigate(`/turmas/${turmaId}`);
    else navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 pb-24">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold">
                {classroomMode ? "Super Importador da Turma" : "Super Importador Global"}
              </h1>
              <Badge variant="secondary">app-piteco-super-import 2.0</Badge>
              {classroomMode && (
                <Badge className="gap-1">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Destino isolado
                </Badge>
              )}
            </div>
            <p className="mt-1 text-muted-foreground">
              {classroomMode
                ? "Texto, CSV e JSON criam pastas, listas, glossários, camadas e cards diretamente nesta turma."
                : "Texto, CSV e JSON usam o mesmo motor transacional enriquecido."}
            </p>
          </div>
          {classroomMode && turmaId ? (
            <Button variant="outline" onClick={() => navigate(`/turmas/${turmaId}`)}>
              Voltar à turma
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate("/import")}>Importador simples</Button>
          )}
        </header>

        {classroomMode && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            Todo conteúdo criado aqui fica isolado na turma atual. Novas pastas são atribuídas automaticamente e obedecem à visibilidade da turma.
          </div>
        )}

        <ImportCapabilitiesPanel
          report={capabilities.data ?? null}
          loading={capabilities.isLoading || capabilities.isFetching}
          requirements={capabilityRequirements}
          onRefresh={() => void capabilities.refetch()}
        />

        <GlobalImportDestinationSection
          mode={destinationMode}
          onModeChange={(nextMode) => {
            setDestinationMode(nextMode);
            if (nextMode !== "existing-folder") {
              setSelectedListId("");
              setSelectedListStrategy("append");
            }
          }}
          catalog={catalog}
          catalogLoading={catalogLoading}
          catalogError={catalogError}
          onRetryCatalog={() => void reloadCatalog()}
          contextLabel={classroomMode ? "Turma atual" : selectedInstitution?.name ?? "Biblioteca Geral"}
          selectedFolderId={selectedFolderId}
          onSelectedFolderChange={(folderId) => {
            setSelectedFolderId(folderId);
            setSelectedListId("");
            setSelectedListStrategy("append");
          }}
          selectedListId={selectedListId}
          onSelectedListChange={(listId) => {
            setSelectedListId(listId);
            setSelectedListStrategy("append");
          }}
          selectedListStrategy={selectedListStrategy}
          onSelectedListStrategyChange={setSelectedListStrategy}
          newFolderName={newFolderName}
          onNewFolderNameChange={setNewFolderName}
        />

        <PromptBuilderCard mode={destinationMode} destinationFolderName={destinationFolderName} />
        <GlobalImportJsonSection value={source.raw} busy={busy} disabled={!capabilityEvaluation.ready} onChange={handleRawChange} onAnalyze={handleAnalyze} onFile={handleFile} />

        {source.validation && capabilityEvaluation.ready && (
          <GlobalImportValidationPreview
            validation={source.validation}
            packageValue={packageToPreview}
            counts={counts}
            notes={source.notes}
            destinationErrors={destinationErrors}
            destinationWarnings={destinationWarnings}
          />
        )}

        {source.validation?.valid && packageToPreview && catalog && destinationPlan && !report && (
          <DestinationMappingCard
            packageValue={packageToPreview}
            catalog={catalog}
            plan={destinationPlan}
            mode={destinationMode}
            onChange={(nextPlan) => {
              setDestinationPlan(nextPlan);
              setReplacementConfirmed(false);
            }}
          />
        )}

        {destinationSummary && !report && (
          <GlobalImportDestinationSummary summary={destinationSummary} />
        )}

        {(destinationSummary || report) && (
          <GlobalImportExecutionSection
            enabled={executionEnabled}
            count={destinationSummary?.cardsImported ?? counts.cards}
            mode={destinationMode}
            replacementListNames={destinationSummary?.replacementListNames ?? []}
            replacementConfirmed={replacementConfirmed}
            onReplacementConfirmedChange={setReplacementConfirmed}
            cardConflict={cardConflict}
            onCardConflictChange={setCardConflict}
            busy={busy}
            progress={progress}
            progressText={progressText}
            destinationErrors={destinationErrors}
            disabledReason={executionDisabledReason}
            stickyAction={!report}
            onImport={handleImport}
            report={report}
            undoing={undoing}
            onUndo={handleUndo}
            openLabel={classroomMode ? "Voltar à turma" : "Abrir minhas pastas"}
            onOpenFolders={() => {
              if (classroomMode && turmaId) navigate(`/turmas/${turmaId}`);
              else navigate("/folders");
            }}
          />
        )}

        <details className="rounded-xl border bg-card">
          <summary className="cursor-pointer select-none p-4 font-medium">
            Ferramentas adicionais de glossário
          </summary>
          <div className="border-t p-3">
            <BulkGlossaryImportPanel catalog={catalog} />
          </div>
        </details>
      </div>
    </div>
  );
}
