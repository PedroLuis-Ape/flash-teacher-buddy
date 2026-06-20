import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DestinationMappingCard } from "./components/DestinationMappingCard";
import { GlobalImportDestinationSection } from "./components/GlobalImportDestinationSection";
import { GlobalImportExecutionSection } from "./components/GlobalImportExecutionSection";
import { GlobalImportJsonSection } from "./components/GlobalImportJsonSection";
import { GlobalImportValidationPreview } from "./components/GlobalImportValidationPreview";
import { PromptBuilderCard } from "./components/PromptBuilderCard";
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
  const source = useGlobalImportSource();
  const [destinationMode, setDestinationMode] = useState<GlobalImportDestinationMode>("from-file");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [listConflictPolicy, setListConflictPolicy] = useState<ExistingListConflictPolicy>("append");
  const [catalog, setCatalog] = useState<ImportDestinationCatalog | null>(null);
  const [destinationPlan, setDestinationPlan] = useState<GlobalImportDestinationPlan | null>(null);
  const [cardConflict, setCardConflict] = useState<CardConflictPolicy>("skip");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [report, setReport] = useState<GlobalImportExecutionReport | null>(null);
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    loadImportDestinationCatalog()
      .then(setCatalog)
      .catch((error) => toast.error(error?.message || "Não foi possível carregar suas pastas."));
  }, []);

  useEffect(() => {
    if (destinationMode === "from-file" && source.validation?.valid && source.validation.package) {
      setDestinationPlan(buildCreateAllDestinationPlan(source.validation.package));
    }
  }, [destinationMode, source.validation]);

  const selectedFolder = catalog?.folders.find((folder) => folder.id === selectedFolderId);
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
      newFolderName,
      listConflictPolicy,
    });
  }, [source.validation, catalog, destinationMode, selectedFolderId, newFolderName, listConflictPolicy]);

  const packageToPreview = destinationMode === "from-file"
    ? source.validation?.package ?? null
    : prepared?.packageValue ?? source.validation?.package ?? null;
  const counts = packageCounts(packageToPreview);
  const destinationErrors = destinationMode === "from-file" ? [] : prepared?.errors ?? [];
  const destinationWarnings = destinationMode === "from-file" ? [] : prepared?.warnings ?? [];

  const prepareValidPackage = async (validation: GlobalImportV2ValidationResult) => {
    setReport(null);
    if (!validation.valid || !validation.package) {
      setDestinationPlan(null);
      toast.error("O pacote possui erros bloqueantes.");
      return;
    }
    if (validation.requestId) updateGlobalImportManifestStatus(validation.requestId, "validated");
    const nextCatalog = catalog ?? await loadImportDestinationCatalog();
    setCatalog(nextCatalog);
    setDestinationPlan(buildCreateAllDestinationPlan(validation.package));
    toast.success("Pacote válido. Revise o destino e a prévia antes de importar.");
  };

  const handleAnalyze = async () => {
    try {
      await prepareValidPackage(source.analyze());
    } catch (error: any) {
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
    const effectivePackage = destinationMode === "from-file" ? validation.package : prepared?.packageValue;
    const effectivePlan = destinationMode === "from-file" ? destinationPlan : prepared?.plan;

    if (prepared?.errors.length && destinationMode !== "from-file") {
      toast.error(prepared.errors[0]);
      return;
    }
    if (!effectivePackage || !effectivePlan) {
      toast.error("Defina um destino válido antes de importar.");
      return;
    }
    const planErrors = validateDestinationPlan(effectivePackage, catalog, effectivePlan);
    if (planErrors.length) {
      toast.error(planErrors[0]);
      return;
    }

    setBusy(true);
    setProgress(0);
    setProgressText("Preparando a importação...");
    try {
      const imported = await executeMappedGlobalImport(effectivePackage, {
        requestId: validation.requestId ?? undefined,
        officialPackage: validation.officialPackage,
        canonicalPackage: validation.canonicalPackage,
        smartPackage: validation.smartPackage,
        destinationPlan: effectivePlan,
        catalog,
        cardConflict,
        institutionId: null,
        onProgress: (completed, total, label) => {
          setProgress(total > 0 ? (completed / total) * 100 : 0);
          setProgressText(`${label} — ${completed}/${total}`);
        },
      });
      setReport(imported);
      setProgress(100);
      setProgressText("Concluído");
      toast.success("Importação global concluída.");
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
      await undoGlobalImport(report.batch_id);
      setReport(null);
      setProgress(0);
      setProgressText("");
      toast.success("A importação foi desfeita.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível desfazer a importação.");
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 pb-24">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold">Super Importador Global</h1>
              <Badge variant="secondary">app-piteco-super-import 2.0</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">Texto, CSV e JSON usam o mesmo motor transacional enriquecido.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/import")}>Importador simples</Button>
        </header>

        <GlobalImportDestinationSection
          mode={destinationMode}
          onModeChange={setDestinationMode}
          catalog={catalog}
          selectedFolderId={selectedFolderId}
          onSelectedFolderChange={setSelectedFolderId}
          newFolderName={newFolderName}
          onNewFolderNameChange={setNewFolderName}
          listConflictPolicy={listConflictPolicy}
          onListConflictPolicyChange={setListConflictPolicy}
        />

        <PromptBuilderCard mode={destinationMode} destinationFolderName={destinationFolderName} />
        <GlobalImportJsonSection value={source.raw} busy={busy} onChange={handleRawChange} onAnalyze={handleAnalyze} onFile={handleFile} />

        {source.validation && (
          <GlobalImportValidationPreview
            validation={source.validation}
            packageValue={packageToPreview}
            counts={counts}
            notes={source.notes}
            destinationErrors={destinationErrors}
            destinationWarnings={destinationWarnings}
          />
        )}

        {source.validation?.valid && source.validation.package && catalog && destinationMode === "from-file" && destinationPlan && !report && (
          <DestinationMappingCard packageValue={source.validation.package} catalog={catalog} plan={destinationPlan} onChange={setDestinationPlan} />
        )}

        <GlobalImportExecutionSection
          enabled={Boolean(source.validation?.valid && source.validation.package && catalog)}
          count={counts.cards}
          mode={destinationMode}
          listConflictPolicy={listConflictPolicy}
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
          onOpenFolders={() => navigate("/folders")}
        />
      </div>
    </div>
  );
}
