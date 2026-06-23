import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, GraduationCap } from "lucide-react";
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

export default function GuidedGlobalImportScreen() {
  const navigate = useNavigate();
  const { turmaId } = useParams<{ turmaId?: string }>();
  const classroomMode = Boolean(turmaId);
  const source = useGlobalImportSource();
  const [flow, setFlow] = useState<V3FlowKind>("quick");
  const [destinationMode, setDestinationMode] = useState<GlobalImportDestinationMode>("from-file");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [listConflictPolicy, setListConflictPolicy] = useState<ExistingListConflictPolicy>("append");
  const [quickFolderId, setQuickFolderId] = useState("");
  const [quickListId, setQuickListId] = useState("");
  const [quickStrategy, setQuickStrategy] = useState<QuickListStrategy>("append");
  const [catalog, setCatalog] = useState<ImportDestinationCatalog | null>(null);
  const [destinationPlan, setDestinationPlan] = useState<GlobalImportDestinationPlan | null>(null);
  const [cardConflict, setCardConflict] = useState<CardConflictPolicy>("skip");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [report, setReport] = useState<GlobalImportExecutionReport | null>(null);
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    setCatalog(null);
    setSelectedFolderId("");
    setQuickFolderId("");
    setQuickListId("");
    loadImportDestinationCatalog(turmaId)
      .then(setCatalog)
      .catch((error) => toast.error(error?.message || "Não foi possível carregar as pastas disponíveis."));
  }, [turmaId]);

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
  const counts = countsOf(packageToPreview);

  const destinationErrors = useMemo(() => {
    if (flow === "structured") return destinationMode === "from-file" ? [] : prepared?.errors ?? [];
    if (!source.validation?.valid) return [];
    return [
      quickMessage,
      quickFolderId ? null : "Escolha a pasta que contém a lista de destino.",
      quickListId ? null : "Escolha a lista que receberá os cards.",
    ].filter((item): item is string => Boolean(item));
  }, [flow, destinationMode, prepared, source.validation, quickMessage, quickFolderId, quickListId]);

  const destinationWarnings = flow === "structured"
    ? destinationMode === "from-file" ? [] : prepared?.warnings ?? []
    : selectedQuickList
      ? [`Destino direto: ${quickStrategy === "replace" ? "substituir" : "adicionar em"} “${selectedQuickList.title}”.`]
      : [];

  const promptContext: GlobalImportPromptDestinationContext = {
    scope: classroomMode ? "classroom" : "personal",
    intent: flow,
    destinationMode: flow === "structured" ? destinationMode : undefined,
    folderName: flow === "quick" ? selectedQuickFolder?.title : destinationFolderName,
    listName: flow === "quick" ? selectedQuickList?.title : undefined,
  };

  const prepareValidPackage = async (validation: GlobalImportV2ValidationResult) => {
    setReport(null);
    if (!validation.valid || !validation.package) {
      setDestinationPlan(null);
      toast.error("O pacote possui erros bloqueantes.");
      return;
    }
    if (validation.requestId) updateGlobalImportManifestStatus(validation.requestId, "validated");
    const nextCatalog = catalog ?? await loadImportDestinationCatalog(turmaId);
    setCatalog(nextCatalog);
    setDestinationPlan(flow === "structured" && destinationMode === "from-file"
      ? buildCreateAllDestinationPlan(validation.package)
      : null);
    toast.success("Pacote válido. Revise o destino e a prévia antes de importar.");
  };

  const handleAnalyze = async () => {
    try { await prepareValidPackage(source.analyze()); }
    catch (error: any) {
      setDestinationPlan(null);
      toast.error(error?.message || "Não foi possível analisar o pacote.");
    }
  };

  const handleFile = async (file?: File) => {
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
  };

  const handleImport = async () => {
    const validation = source.validation;
    if (!validation?.valid || !validation.package || !catalog) return;
    if (classroomMode && !turmaId) return;
    if (destinationErrors.length) return toast.error(destinationErrors[0]);

    const effectivePackage = flow === "quick" || destinationMode === "from-file"
      ? validation.package
      : prepared?.packageValue;
    const effectivePlan = flow === "quick"
      ? quickPlan
      : destinationMode === "from-file"
        ? destinationPlan
        : prepared?.plan;
    if (!effectivePackage || !effectivePlan) return toast.error("Defina um destino válido antes de importar.");

    const replacing = flow === "quick"
      ? quickStrategy === "replace"
      : destinationMode === "existing-folder" && listConflictPolicy === "replace";
    if (replacing && !window.confirm("O conteúdo existente correspondente será substituído. Deseja continuar?")) return;

    const planErrors = validateDestinationPlan(effectivePackage, catalog, effectivePlan);
    if (planErrors.length) return toast.error(planErrors[0]);

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
        catalog,
        cardConflict,
        institutionId: null,
        turmaId: turmaId ?? null,
        onProgress: (completed, total, label) => {
          setProgress(total > 0 ? (completed / total) * 100 : 0);
          setProgressText(`${label} — ${completed}/${total}`);
        },
      });
      setReport(imported);
      setProgress(100);
      setProgressText("Concluído");
      toast.success(classroomMode ? "Lote importado e atribuído à turma." : "Importação global concluída.");
    } catch (error: any) {
      toast.error(error?.message || "A importação falhou e foi desfeita.");
    } finally { setBusy(false); }
  };

  const handleUndo = async () => {
    if (!report?.batch_id) return;
    setUndoing(true);
    try {
      await undoGlobalImport(report.batch_id, classroomMode ? "classroom" : "personal");
      setReport(null);
      setProgress(0);
      setProgressText("");
      toast.success(classroomMode ? "O lote e suas atribuições foram removidos da turma." : "A importação foi desfeita.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível desfazer a importação.");
    } finally { setUndoing(false); }
  };

  const stage = report ? 4 : source.validation ? 3 : source.raw.trim() ? 2 : 1;
  const useLegacy = () => {
    window.localStorage.setItem(V3_STORAGE_KEY, "disabled");
    window.location.assign(window.location.pathname);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 pb-24">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => classroomMode && turmaId ? navigate(`/turmas/${turmaId}`) : navigate(-1)} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold">Importar conteúdo</h1>
              <Badge variant="secondary">Super Importador V3</Badge>
              {classroomMode ? <Badge className="gap-1"><GraduationCap className="h-3.5 w-3.5" />Turma isolada</Badge> : <Badge variant="outline">Biblioteca pessoal</Badge>}
            </div>
            <p className="mt-1 text-muted-foreground">Escolha uma tarefa e avance em etapas claras. O motor transacional atual continua sendo utilizado.</p>
          </div>
          <Button variant="outline" onClick={useLegacy}>Usar importador anterior</Button>
        </header>

        {classroomMode && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">Pastas e listas pessoais não aparecem aqui. Todo conteúdo criado nesta tela fica associado à turma atual.</div>}
        <Card className="p-5"><FlowChoicePanel value={flow} onChange={setFlow} /></Card>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {["Destino", "Conteúdo", "Revisão", "Importação"].map((label, index) => {
            const number = index + 1;
            const done = stage > number;
            return <div key={label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${stage === number ? "border-primary bg-primary/5" : done ? "bg-muted/50" : "text-muted-foreground"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{done ? <Check className="h-3.5 w-3.5" /> : number}</span><span className="font-medium">{label}</span></div>;
          })}
        </div>

        <section className="space-y-3">
          <div><h2 className="text-xl font-semibold">1. Escolha o destino</h2><p className="text-sm text-muted-foreground">O aplicativo controla o destino real e impede mistura entre biblioteca pessoal e turma.</p></div>
          {flow === "quick"
            ? <QuickDestinationPanel catalog={catalog} folderId={quickFolderId} listId={quickListId} strategy={quickStrategy} onFolderChange={(value) => { setQuickFolderId(value); setQuickListId(""); }} onListChange={setQuickListId} onStrategyChange={setQuickStrategy} />
            : <StructuredDestinationPanel mode={destinationMode} onModeChange={setDestinationMode} catalog={catalog} selectedFolderId={selectedFolderId} onSelectedFolderChange={setSelectedFolderId} newFolderName={newFolderName} onNewFolderNameChange={setNewFolderName} listConflictPolicy={listConflictPolicy} onListConflictPolicyChange={setListConflictPolicy} />}
        </section>

        <section className="space-y-3">
          <div><h2 className="text-xl font-semibold">2. Crie ou adicione o conteúdo</h2><p className="text-sm text-muted-foreground">Gere com IA, cole o conteúdo ou envie um arquivo.</p></div>
          {classroomMode
            ? <PromptBuilderCard mode={flow === "quick" ? "existing-folder" : destinationMode} destinationFolderName={flow === "quick" ? selectedQuickFolder?.title : destinationFolderName} />
            : <AiPromptPresetSelector context={promptContext} />}
          <GlobalImportJsonSection value={source.raw} busy={busy} onChange={handleRawChange} onAnalyze={handleAnalyze} onFile={handleFile} />
        </section>

        {source.validation && <section className="space-y-3"><div><h2 className="text-xl font-semibold">3. Revise antes de importar</h2><p className="text-sm text-muted-foreground">A análise não altera o banco. Confira estrutura, cards em camadas e avisos.</p></div><GlobalImportValidationPreview validation={source.validation} packageValue={packageToPreview} counts={counts} notes={source.notes} destinationErrors={destinationErrors} destinationWarnings={destinationWarnings} /></section>}

        {flow === "structured" && source.validation?.valid && source.validation.package && catalog && destinationMode === "from-file" && destinationPlan && !report && <DestinationMappingCard packageValue={source.validation.package} catalog={catalog} plan={destinationPlan} onChange={setDestinationPlan} />}

        <section className="space-y-3">
          <div><h2 className="text-xl font-semibold">4. Confirme a importação</h2><p className="text-sm text-muted-foreground">Somente o botão abaixo grava dados. O desfazer continua disponível.</p></div>
          <GlobalImportExecutionSection enabled={Boolean(source.validation?.valid && source.validation.package && catalog)} count={counts.cards} mode={flow === "quick" ? "existing-folder" : destinationMode} listConflictPolicy={flow === "quick" ? quickStrategy : listConflictPolicy} cardConflict={cardConflict} onCardConflictChange={setCardConflict} busy={busy} progress={progress} progressText={progressText} destinationErrors={destinationErrors} onImport={handleImport} report={report} undoing={undoing} onUndo={handleUndo} openLabel={classroomMode ? "Voltar à turma" : "Abrir minhas pastas"} onOpenFolders={() => classroomMode && turmaId ? navigate(`/turmas/${turmaId}`) : navigate("/folders")} />
        </section>

        {!classroomMode && <details className="rounded-xl border bg-card"><summary className="cursor-pointer select-none p-4 font-medium">Ferramentas adicionais da Caixa de Glossário</summary><div className="border-t p-3"><BulkGlossaryImportPanel catalog={catalog} /></div></details>}
      </div>
    </div>
  );
}
