import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowLeft, Check, ChevronLeft, ChevronRight, GraduationCap, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AiPromptPresetSelector } from "./components/AiPromptPresetSelector";
import { BulkGlossaryImportPanel } from "./components/BulkGlossaryImportPanel";
import { DestinationMappingCard } from "./components/DestinationMappingCard";
import { FlowChoicePanel, type V3FlowKind } from "./components/FlowChoicePanel";
import { GlobalImportExecutionSection } from "./components/GlobalImportExecutionSection";
import { GlobalImportJsonSection } from "./components/GlobalImportJsonSection";
import { GlobalImportValidationPreview } from "./components/GlobalImportValidationPreview";
import { ImportSimulationTree } from "./components/ImportSimulationTree";
import { PromptBuilderCard } from "./components/PromptBuilderCard";
import { QuickDestinationPanel } from "./components/QuickDestinationPanel";
import { StructuredDestinationPanel } from "./components/StructuredDestinationPanel";
import {
  loadImportDestinationCatalog,
  validateDestinationPlan,
  type GlobalImportDestinationPlan,
  type ImportDestinationCatalog,
} from "./destination";
import {
  buildCreateAllDestinationPlan,
  prepareGlobalImportDestination,
  type ExistingListConflictPolicy,
  type GlobalImportDestinationMode,
} from "./destinationModes";
import { updateGlobalImportManifestStatus } from "./manifest";
import {
  executeMappedGlobalImport,
  undoGlobalImport,
  type CardConflictPolicy,
  type GlobalImportExecutionReport,
} from "./mappedService";
import type { GlobalImportPromptDestinationContext } from "./prompts/presets";
import {
  buildQuickListDestinationPlan,
  quickImportStructureError,
  type QuickListStrategy,
} from "./quickListDestination";
import type { GlobalImportPackage } from "./schema";
import { useGlobalImportSource } from "./useGlobalImportSource";
import type { GlobalImportV2ValidationResult } from "./validation";

const V3_STORAGE_KEY = "app-piteco:super-import-v3";
type WizardStep = 1 | 2 | 3 | 4;

function countsOf(value: GlobalImportPackage | null) {
  if (!value) return { folders: 0, lists: 0, cards: 0 };
  return value.package.folders.reduce(
    (total, folder) => ({
      folders: total.folders + 1,
      lists: total.lists + folder.lists.length,
      cards: total.cards + folder.lists.reduce((sum, list) => sum + list.cards.length, 0),
    }),
    { folders: 0, lists: 0, cards: 0 },
  );
}

function blockingSummary(validation: GlobalImportV2ValidationResult): string {
  const errors = validation.issues.filter((issue) => issue.severity === "error");
  if (!errors.length) return "O pacote possui erros bloqueantes.";
  const first = errors[0];
  const rest = errors.length > 1 ? ` (+${errors.length - 1} erro(s) semelhante(s))` : "";
  return `${first.path}: ${first.message}${rest}`;
}

export default function OwnerGuidedImportWizard() {
  const navigate = useNavigate();
  const { turmaId } = useParams<{ turmaId?: string }>();
  const classroomMode = Boolean(turmaId);
  const source = useGlobalImportSource({ repairSmartJson: true });
  const cancelRequestedRef = useRef(false);

  const [step, setStep] = useState<WizardStep>(1);
  const [flow, setFlow] = useState<V3FlowKind>("quick");
  const [destinationMode, setDestinationMode] = useState<GlobalImportDestinationMode>("from-file");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [listConflictPolicy, setListConflictPolicy] = useState<ExistingListConflictPolicy>("append");
  const [quickFolderId, setQuickFolderId] = useState("");
  const [quickListId, setQuickListId] = useState("");
  const [quickStrategy, setQuickStrategy] = useState<QuickListStrategy>("append");
  const [catalog, setCatalog] = useState<ImportDestinationCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [destinationPlan, setDestinationPlan] = useState<GlobalImportDestinationPlan | null>(null);
  const [cardConflict, setCardConflict] = useState<CardConflictPolicy>("skip");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [report, setReport] = useState<GlobalImportExecutionReport | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);

  const refreshCatalog = useCallback(async (showErrorToast = true): Promise<ImportDestinationCatalog> => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const nextCatalog = await loadImportDestinationCatalog(turmaId);
      setCatalog(nextCatalog);
      return nextCatalog;
    } catch (error: any) {
      const message = error?.message || "Não foi possível carregar as pastas e listas disponíveis.";
      setCatalog(null);
      setCatalogError(message);
      if (showErrorToast) toast.error(message);
      throw error;
    } finally {
      setCatalogLoading(false);
    }
  }, [turmaId]);

  useEffect(() => {
    setCatalog(null);
    setSelectedFolderId("");
    setQuickFolderId("");
    setQuickListId("");
    void refreshCatalog(false).catch(() => undefined);
  }, [refreshCatalog]);

  useEffect(() => {
    if (flow === "structured" && destinationMode === "from-file" && source.validation?.valid && source.validation.package) {
      setDestinationPlan(buildCreateAllDestinationPlan(source.validation.package));
    }
  }, [flow, destinationMode, source.validation]);

  const selectedFolder = catalog?.folders.find((folder) => folder.id === selectedFolderId);
  const selectedQuickFolder = catalog?.folders.find((folder) => folder.id === quickFolderId);
  const quickLists = (catalog?.lists ?? []).filter((list) => list.folder_id === quickFolderId);
  const selectedQuickList = quickLists.find((list) => list.id === quickListId);
  const destinationFolderName = destinationMode === "existing-folder"
    ? selectedFolder?.title
    : destinationMode === "new-folder"
      ? newFolderName
      : undefined;

  const prepared = useMemo(() => {
    if (flow !== "structured" || !source.validation?.valid || !source.validation.package || !catalog) return null;
    return prepareGlobalImportDestination(source.validation.package, catalog, {
      mode: destinationMode,
      existingFolderId: selectedFolderId,
      newFolderName,
      listConflictPolicy,
    });
  }, [flow, source.validation, catalog, destinationMode, selectedFolderId, newFolderName, listConflictPolicy]);

  const quickMessage = quickImportStructureError(source.validation?.package ?? null);
  const quickPlan = useMemo(() => {
    if (flow !== "quick" || !source.validation?.valid || !source.validation.package) return null;
    return buildQuickListDestinationPlan(source.validation.package, quickFolderId, quickListId, quickStrategy);
  }, [flow, source.validation, quickFolderId, quickListId, quickStrategy]);

  const packageToPreview = flow === "quick" || destinationMode === "from-file"
    ? source.validation?.package ?? null
    : prepared?.packageValue ?? source.validation?.package ?? null;
  const effectivePlan = flow === "quick"
    ? quickPlan
    : destinationMode === "from-file"
      ? destinationPlan
      : prepared?.plan ?? null;
  const counts = countsOf(packageToPreview);

  const destinationErrors = useMemo(() => {
    const errors = flow === "structured"
      ? destinationMode === "from-file" ? [] : prepared?.errors ?? []
      : source.validation?.valid
        ? [
            quickMessage,
            quickFolderId ? null : "Escolha a pasta que contém a lista de destino.",
            quickListId ? null : "Escolha a lista que receberá os cards.",
          ].filter((item): item is string => Boolean(item))
        : [];

    if (source.validation?.valid && packageToPreview && catalog && effectivePlan) {
      errors.push(...validateDestinationPlan(packageToPreview, catalog, effectivePlan));
    }
    return Array.from(new Set(errors));
  }, [flow, destinationMode, prepared, source.validation, quickMessage, quickFolderId, quickListId, packageToPreview, catalog, effectivePlan]);

  const destinationWarnings = flow === "structured"
    ? destinationMode === "from-file" ? [] : prepared?.warnings ?? []
    : selectedQuickList
      ? [`Destino direto: ${quickStrategy === "replace" ? "substituir" : "adicionar em"} “${selectedQuickList.title}”.`]
      : [];

  const destinationReady = flow === "quick"
    ? Boolean(quickFolderId && quickListId)
    : destinationMode === "from-file"
      || (destinationMode === "existing-folder" && Boolean(selectedFolderId))
      || (destinationMode === "new-folder" && Boolean(newFolderName.trim()));

  const catalogRequiredNow = flow === "quick"
    || (flow === "structured" && destinationMode === "existing-folder");
  const canContinueFromDestination = destinationReady
    && (!catalogRequiredNow || Boolean(catalog));
  const canContinueToConfirmation = Boolean(
    source.validation?.valid
    && packageToPreview
    && catalog
    && effectivePlan
    && destinationErrors.length === 0,
  );

  const promptContext: GlobalImportPromptDestinationContext = {
    scope: classroomMode ? "classroom" : "personal",
    intent: flow,
    destinationMode: flow === "structured" ? destinationMode : undefined,
    folderName: flow === "quick" ? selectedQuickFolder?.title : destinationFolderName,
    listName: flow === "quick" ? selectedQuickList?.title : undefined,
  };

  const moveToStep = (next: WizardStep) => {
    setStep(next);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const prepareValidPackage = async (validation: GlobalImportV2ValidationResult) => {
    setReport(null);
    if (!validation.valid || !validation.package) {
      setDestinationPlan(null);
      moveToStep(2);
      toast.error(blockingSummary(validation));
      return;
    }
    if (validation.requestId) updateGlobalImportManifestStatus(validation.requestId, "validated");
    const nextCatalog = catalog ?? await refreshCatalog(true);
    setDestinationPlan(flow === "structured" && destinationMode === "from-file"
      ? buildCreateAllDestinationPlan(validation.package)
      : null);
    setCatalog(nextCatalog);
    moveToStep(3);
    toast.success("Pacote válido. Confira a simulação antes de importar.");
  };

  const handleAnalyze = async () => {
    try {
      await prepareValidPackage(source.analyze());
    } catch (error: any) {
      setDestinationPlan(null);
      moveToStep(2);
      toast.error(error?.message || "Não foi possível analisar o pacote.");
    }
  };

  const handleFile = async (file?: File) => {
    try {
      const result = await source.readFile(file);
      if (result) await prepareValidPackage(result.validation);
    } catch (error: any) {
      moveToStep(2);
      toast.error(error?.message || "Não foi possível ler o arquivo.");
    }
  };

  const handleRawChange = (value: string) => {
    source.reset(value);
    setDestinationPlan(null);
    setReport(null);
    setProgress(0);
    setProgressText("");
  };

  const clearAttempt = () => {
    source.reset("");
    setStep(1);
    setFlow("quick");
    setDestinationMode("from-file");
    setSelectedFolderId("");
    setNewFolderName("");
    setListConflictPolicy("append");
    setQuickFolderId("");
    setQuickListId("");
    setQuickStrategy("append");
    setDestinationPlan(null);
    setCardConflict("skip");
    setProgress(0);
    setProgressText("");
    setReport(null);
    setCancelRequested(false);
    cancelRequestedRef.current = false;
  };

  const handleCancelAttempt = () => {
    if (!source.raw.trim() && !source.validation) return clearAttempt();
    if (window.confirm("Descartar esta tentativa de importação? O conteúdo ainda não foi gravado.")) clearAttempt();
  };

  const requestSafeCancellation = () => {
    cancelRequestedRef.current = true;
    setCancelRequested(true);
    setProgressText("Cancelamento solicitado. Aguardando o lote para desfazer com segurança...");
  };

  const handleImport = async () => {
    const validation = source.validation;
    if (!validation?.valid || !packageToPreview || !effectivePlan || !catalog) return;
    if (classroomMode && !turmaId) return;
    if (destinationErrors.length) return toast.error(destinationErrors[0]);

    const replacing = flow === "quick"
      ? quickStrategy === "replace"
      : destinationMode === "existing-folder" && listConflictPolicy === "replace";
    if (replacing && !window.confirm("O conteúdo existente correspondente será substituído. Deseja continuar?")) return;

    cancelRequestedRef.current = false;
    setCancelRequested(false);
    setBusy(true);
    setProgress(0);
    setProgressText("Preparando a importação...");
    try {
      const imported = await executeMappedGlobalImport(packageToPreview, {
        requestId: classroomMode ? undefined : validation.requestId ?? undefined,
        officialPackage: validation.officialPackage,
        canonicalPackage: validation.canonicalPackage,
        smartPackage: validation.smartPackage,
        destinationPlan: effectivePlan,
        catalog,
        cardConflict,
        institutionId: null,
        turmaId: turmaId ?? null,
        onProgress: (completed, total, label) => {
          setProgress(total > 0 ? (completed / total) * 100 : 0);
          setProgressText(`${label} — ${completed}/${total}`);
        },
      });

      if (cancelRequestedRef.current) {
        setProgressText("Desfazendo o lote cancelado...");
        try {
          await undoGlobalImport(imported.batch_id, classroomMode ? "classroom" : "personal");
          clearAttempt();
          toast.success("A importação foi cancelada e o lote criado foi removido.");
          return;
        } catch {
          setReport(imported);
          toast.error("O lote terminou, mas o desfazer automático falhou. Use o botão Desfazer esta importação.");
          return;
        }
      }

      setReport(imported);
      setProgress(100);
      setProgressText("Concluído");
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      toast.success(classroomMode ? "Lote importado e atribuído à turma." : "Importação global concluída.");
    } catch (error: any) {
      toast.error(error?.message || "A importação falhou e foi desfeita.");
    } finally {
      setBusy(false);
      setCancelRequested(false);
      cancelRequestedRef.current = false;
    }
  };

  const handleUndo = async () => {
    if (!report?.batch_id) return;
    setUndoing(true);
    try {
      await undoGlobalImport(report.batch_id, classroomMode ? "classroom" : "personal");
      clearAttempt();
      toast.success(classroomMode ? "O lote e suas atribuições foram removidos da turma." : "A importação foi desfeita.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível desfazer a importação.");
    } finally {
      setUndoing(false);
    }
  };

  const useLegacy = () => {
    window.localStorage.setItem(V3_STORAGE_KEY, "disabled");
    window.location.assign(window.location.pathname);
  };

  const openImportedDestination = () => {
    const target = classroomMode && turmaId ? `/turmas/${turmaId}` : "/folders";
    window.location.assign(target);
  };

  const actionDock = !report && typeof document !== "undefined"
    ? createPortal(
        <div
          data-super-import-actions="true"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[2147483000] border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_35px_rgba(0,0,0,0.28)] backdrop-blur"
        >
          <div className="pointer-events-auto mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={handleCancelAttempt} disabled={busy}>
              <XCircle className="mr-2 h-4 w-4" />Cancelar tentativa
            </Button>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {step === 3 && !canContinueToConfirmation && (
                <span className="max-w-sm text-right text-xs text-destructive">
                  {destinationErrors[0] ?? "A simulação ainda não terminou de preparar o destino."}
                </span>
              )}
              {step > 1 && (
                <Button type="button" variant="outline" onClick={() => moveToStep((step - 1) as WizardStep)} disabled={busy}>
                  <ChevronLeft className="mr-2 h-4 w-4" />Voltar
                </Button>
              )}
              {step === 1 && (
                <Button type="button" onClick={() => moveToStep(2)} disabled={!canContinueFromDestination}>
                  {catalogLoading && catalogRequiredNow
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando destinos...</>
                    : <>Continuar<ChevronRight className="ml-2 h-4 w-4" /></>}
                </Button>
              )}
              {step === 2 && source.validation?.valid && (
                <Button type="button" onClick={() => moveToStep(3)}>
                  Ver simulação<ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              {step === 3 && (
                <Button type="button" onClick={() => moveToStep(4)} disabled={!canContinueToConfirmation}>
                  Continuar para confirmar<ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 pb-28">
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="flex flex-wrap items-start gap-4">
            <Button type="button" variant="ghost" size="icon" onClick={() => classroomMode && turmaId ? navigate(`/turmas/${turmaId}`) : navigate(-1)} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold">Importar conteúdo</h1>
                <Badge variant="secondary">Canário do proprietário</Badge>
                {classroomMode
                  ? <Badge className="gap-1"><GraduationCap className="h-3.5 w-3.5" />Turma isolada</Badge>
                  : <Badge variant="outline">Biblioteca pessoal</Badge>}
              </div>
              <p className="mt-1 text-muted-foreground">
                {report
                  ? "A importação terminou e o lote já foi gravado com segurança."
                  : "Você pode avançar e voltar sem perder o JSON, o destino ou a análise."}
              </p>
            </div>
            {!report && <Button type="button" variant="outline" onClick={useLegacy}>Usar importador anterior</Button>}
          </header>

          {classroomMode && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
              Pastas e listas pessoais não aparecem aqui. Cards e camadas ficam na turma; o glossário é centralizado na conta do professor.
            </div>
          )}

          <WizardProgress
            step={step}
            completed={Boolean(report)}
            onStep={(next) => {
              if (next < step && !busy && !report) moveToStep(next);
            }}
          />

          {step === 1 && (
            <section className="space-y-5">
              <Card className="p-5"><FlowChoicePanel value={flow} onChange={setFlow} /></Card>
              <div>
                <h2 className="text-xl font-semibold">Escolha o destino</h2>
                <p className="text-sm text-muted-foreground">Essa decisão define como a estrutura será simulada depois da análise.</p>
              </div>
              {flow === "quick"
                ? <QuickDestinationPanel catalog={catalog} folderId={quickFolderId} listId={quickListId} strategy={quickStrategy} onFolderChange={(value) => { setQuickFolderId(value); setQuickListId(""); }} onListChange={setQuickListId} onStrategyChange={setQuickStrategy} />
                : <StructuredDestinationPanel mode={destinationMode} onModeChange={setDestinationMode} catalog={catalog} selectedFolderId={selectedFolderId} onSelectedFolderChange={setSelectedFolderId} newFolderName={newFolderName} onNewFolderNameChange={setNewFolderName} listConflictPolicy={listConflictPolicy} onListConflictPolicyChange={setListConflictPolicy} />}

              {catalogLoading && (
                <Card className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando as pastas e listas da {classroomMode ? "turma" : "conta"}...
                </Card>
              )}

              {catalogError && (
                <Card className="space-y-3 border-destructive/30 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Não foi possível carregar as pastas e listas.</p>
                      <p className="mt-1 text-sm text-muted-foreground">{catalogError}</p>
                      {!catalogRequiredNow && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Você pode continuar com a estrutura do arquivo. O aplicativo tentará carregar os destinos novamente após analisar o JSON.
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void refreshCatalog(true)
                        .then(() => toast.success("Pastas e listas carregadas."))
                        .catch(() => undefined);
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />Tentar carregar novamente
                  </Button>
                </Card>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Adicione o JSON</h2>
                <p className="text-sm text-muted-foreground">O App Piteco corrige automaticamente alguns erros comuns de formatação antes de validar.</p>
              </div>
              {classroomMode
                ? <PromptBuilderCard mode={flow === "quick" ? "existing-folder" : destinationMode} destinationFolderName={flow === "quick" ? selectedQuickFolder?.title : destinationFolderName} />
                : <AiPromptPresetSelector context={promptContext} />}
              <GlobalImportJsonSection value={source.raw} busy={busy} onChange={handleRawChange} onAnalyze={handleAnalyze} onFile={handleFile} />
              {source.validation && !source.validation.valid && (
                <GlobalImportValidationPreview validation={source.validation} packageValue={null} counts={{ folders: 0, lists: 0, cards: 0 }} notes={source.notes} destinationErrors={[]} destinationWarnings={[]} />
              )}
            </section>
          )}

          {step === 3 && source.validation && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Simulação da importação</h2>
                <p className="text-sm text-muted-foreground">Revise a estrutura final. Nada foi gravado ainda.</p>
              </div>
              <GlobalImportValidationPreview validation={source.validation} packageValue={packageToPreview} counts={counts} notes={source.notes} destinationErrors={destinationErrors} destinationWarnings={destinationWarnings} />
              {flow === "structured" && source.validation.valid && source.validation.package && catalog && destinationMode === "from-file" && destinationPlan && (
                <DestinationMappingCard packageValue={source.validation.package} catalog={catalog} plan={destinationPlan} onChange={setDestinationPlan} />
              )}
              {source.validation.valid && packageToPreview && catalog && effectivePlan && (
                <ImportSimulationTree packageValue={packageToPreview} smartPackage={source.validation.smartPackage} catalog={catalog} plan={effectivePlan} />
              )}
            </section>
          )}

          {step === 4 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">{report ? "Importação concluída" : "Confirme a importação"}</h2>
                <p className="text-sm text-muted-foreground">
                  {report
                    ? "O processo terminou. Não existe outra etapa pendente de confirmação."
                    : "Esta é a única etapa que grava dados. Você ainda pode voltar antes de iniciar."}
                </p>
              </div>
              <GlobalImportExecutionSection
                enabled={Boolean(source.validation?.valid && packageToPreview && catalog && effectivePlan)}
                count={counts.cards}
                mode={flow === "quick" ? "existing-folder" : destinationMode}
                listConflictPolicy={flow === "quick" ? quickStrategy : listConflictPolicy}
                cardConflict={cardConflict}
                onCardConflictChange={setCardConflict}
                busy={busy}
                progress={progress}
                progressText={progressText}
                destinationErrors={destinationErrors}
                onImport={handleImport}
                report={report}
                undoing={undoing}
                onUndo={handleUndo}
                openLabel={classroomMode ? "Voltar à turma" : "Abrir minhas pastas"}
                onOpenFolders={openImportedDestination}
              />
              {busy && !report && (
                <Card className="space-y-2 border-destructive/20 p-4">
                  <Button type="button" variant="outline" className="w-full" onClick={requestSafeCancellation} disabled={cancelRequested}>
                    <XCircle className="mr-2 h-4 w-4" />
                    {cancelRequested ? "Cancelamento solicitado" : "Cancelar e desfazer ao concluir"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    A transação termina com segurança e, em seguida, o lote é desfeito automaticamente.
                  </p>
                </Card>
              )}
            </section>
          )}

          {!classroomMode && step !== 4 && (
            <details className="rounded-xl border bg-card">
              <summary className="cursor-pointer select-none p-4 font-medium">Ferramentas adicionais da Caixa de Glossário</summary>
              <div className="border-t p-3"><BulkGlossaryImportPanel catalog={catalog} /></div>
            </details>
          )}
        </div>
      </div>
      {actionDock}
    </>
  );
}

function WizardProgress({ step, completed, onStep }: { step: WizardStep; completed: boolean; onStep: (step: WizardStep) => void }) {
  const labels = ["Destino", "JSON", "Simulação", "Importação"];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Progresso da importação">
      {labels.map((label, index) => {
        const number = (index + 1) as WizardStep;
        const done = completed || step > number;
        const active = !completed && step === number;
        return (
          <button
            type="button"
            key={label}
            onClick={() => done && !completed && onStep(number)}
            disabled={!done || completed}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${active ? "border-primary bg-primary/5" : done ? "border-primary/30 bg-primary/10" : "text-muted-foreground"}`}
          >
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {done ? <Check className="h-3.5 w-3.5" /> : number}
            </span>
            <span className="font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
