import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Brain, Check, Clipboard, Eye, FileJson2, Loader2, RotateCcw, Upload, Zap } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  buildExistingListImportPlan,
  existingListTargetFromCatalog,
  reconcileExistingListCards,
  type ExistingListImportStrategy,
} from "@/features/global-import/existingListImportPlan";
import { loadExistingListDestinationCatalog } from "@/features/global-import/destinationCatalog";
import {
  executeMappedGlobalImport,
  undoGlobalImport,
  type CardConflictPolicy,
  type GlobalImportExecutionReport,
} from "@/features/global-import/mappedService";
import { parsePastedFlashcards } from "@/lib/bulkImport";
import { COMPLETE_IMPORT_FILE_ACCEPT, readCompleteImportFile } from "./importFile";
import { parseAnySmartImportSource } from "./parseAnySource";
import type { SmartImportPromptOptions } from "./prompt";
import { ReviewPanel } from "./ReviewPanel";
import {
  smartImportPackageSchema,
  withSmartDeclaredTotals,
  type SmartImportPackage,
} from "./schema";
import { buildSimpleFlashcardPrompt } from "./simplePrompt";
import { SmartPromptDialog } from "./SmartPromptDialog";
import type { SmartImportContext, SmartImportSourceResult } from "./sourceParser";

interface Props {
  listId: string;
  onImported: () => void;
  existingCards?: { term: string; translation: string }[];
  labelA?: string;
  labelB?: string;
  langA?: string;
  langB?: string;
}

type ImportMode = "simple" | "complete";
type Step = 1 | 2 | 3;

const TERM_DUPLICATE_CHUNK_SIZE = 500;

function normalizeTermForAccountCheck(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function extractTermsForAccountDuplicateCheck(packageValue: SmartImportPackage): string[] {
  const terms: string[] = [];
  const folders = (packageValue as any)?.package?.folders ?? [];

  for (const folder of folders) {
    for (const list of folder?.lists ?? []) {
      for (const card of list?.cards ?? []) {
        if (card?.type === "normal" && typeof card.front === "string") {
          terms.push(card.front);
        }
        if (card?.type === "layered" && Array.isArray(card.layers)) {
          for (const layer of card.layers) {
            if (typeof layer?.front === "string") terms.push(layer.front);
          }
        }
      }
    }
  }

  return terms;
}

async function loadAccountTermDuplicateCounts(terms: string[]): Promise<Record<string, number>> {
  const uniqueByNormalized = new Map<string, string>();

  for (const term of terms) {
    const normalized = normalizeTermForAccountCheck(term);
    if (normalized && !uniqueByNormalized.has(normalized)) uniqueByNormalized.set(normalized, term);
  }

  const uniqueTerms = Array.from(uniqueByNormalized.values());
  const counts: Record<string, number> = {};

  for (let i = 0; i < uniqueTerms.length; i += TERM_DUPLICATE_CHUNK_SIZE) {
    const chunk = uniqueTerms.slice(i, i + TERM_DUPLICATE_CHUNK_SIZE);
    const { data, error } = await (supabase as any).rpc("get_term_duplicate_counts", { p_terms: chunk });
    if (error) throw error;

    for (const row of (data ?? []) as Array<{ normalized_term: string; existing_count: number | string }>) {
      counts[row.normalized_term] = Number(row.existing_count ?? 0);
    }
  }

  return counts;
}

export function ContentIngestDialog({
  listId,
  onImported,
  existingCards = [],
  labelA = "Lado A",
  labelB = "Lado B",
  langA = "en",
  langB = "pt-BR",
}: Props) {
  const completeFileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<ImportMode>("simple");
  const [raw, setRaw] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [parsed, setParsed] = useState<SmartImportSourceResult | null>(null);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof loadExistingListDestinationCatalog>> | null>(null);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [showSimplePrompt, setShowSimplePrompt] = useState(false);
  const [strategy, setStrategy] = useState<ExistingListImportStrategy>("append");
  const [policy, setPolicy] = useState<CardConflictPolicy>("skip");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [report, setReport] = useState<GlobalImportExecutionReport | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [accountTermCounts, setAccountTermCounts] = useState<Record<string, number>>({});
  const [checkingAccountDuplicates, setCheckingAccountDuplicates] = useState(false);
  const [accountDuplicateError, setAccountDuplicateError] = useState("");
  const [options, setOptions] = useState<SmartImportPromptOptions>({
    languageA: langA,
    languageB: langB,
    outputFormat: "json",
    includeGlobalGlossary: true,
    includeContextGlossary: true,
    includeDetailedExplanations: true,
    includeUsageNotes: true,
    includeCommonMistakes: true,
    includeLayeredCards: true,
  });

  useEffect(() => {
    if (!open) return;
    setLoadingTarget(true);
    loadExistingListDestinationCatalog(listId)
      .then(setCatalog)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível carregar a lista."))
      .finally(() => setLoadingTarget(false));
  }, [listId, open]);

  const target = useMemo(
    () => catalog ? existingListTargetFromCatalog(catalog, listId) : null,
    [catalog, listId],
  );

  const simplePrompt = buildSimpleFlashcardPrompt({
    listName: target?.listName ?? "Lista atual",
    sideALabel: target?.labelA ?? labelA,
    sideBLabel: target?.labelB ?? labelB,
  });

  const prepared = useMemo(() => {
    if (!parsed || !target) return null;
    return buildExistingListImportPlan(parsed.packageValue, target, strategy);
  }, [parsed, strategy, target]);

  const reconciliation = useMemo(() => {
    if (!parsed || !target) return null;
    return reconcileExistingListCards(
      parsed.packageValue,
      target,
      strategy === "replace" ? [] : existingCards,
    );
  }, [existingCards, parsed, strategy, target]);

  const reviewParsed = useMemo<SmartImportSourceResult | null>(() => {
    if (!parsed || !prepared) return null;
    return {
      ...parsed,
      packageValue: prepared.smartPackage,
      warnings: [...parsed.warnings, ...prepared.warnings],
    };
  }, [parsed, prepared]);

  useEffect(() => {
    if (!reviewParsed?.packageValue || step !== 2) {
      setAccountTermCounts({});
      setAccountDuplicateError("");
      setCheckingAccountDuplicates(false);
      return;
    }

    const terms = extractTermsForAccountDuplicateCheck(reviewParsed.packageValue);
    if (!terms.length) {
      setAccountTermCounts({});
      setAccountDuplicateError("");
      setCheckingAccountDuplicates(false);
      return;
    }

    let cancelled = false;
    setCheckingAccountDuplicates(true);
    setAccountDuplicateError("");

    loadAccountTermDuplicateCounts(terms)
      .then((counts) => {
        if (!cancelled) setAccountTermCounts(counts);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Account duplicate check failed:", error);
          setAccountTermCounts({});
          setAccountDuplicateError(error instanceof Error ? error.message : "Não foi possível checar duplicados na conta.");
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingAccountDuplicates(false);
      });

    return () => { cancelled = true; };
  }, [reviewParsed?.packageValue, step]);

  const accountDuplicateTerms = useMemo(
    () => Object.values(accountTermCounts).filter((count) => count > 0).length,
    [accountTermCounts],
  );

  const duplicatePolicyBlocked = policy === "error" && Boolean(reconciliation?.cardsDuplicates);

  const reset = () => {
    setStep(1);
    setMode("simple");
    setRaw("");
    setSelectedFileName("");
    setParsed(null);
    setShowSimplePrompt(false);
    setStrategy("append");
    setPolicy("skip");
    setProgress(0);
    setProgressLabel("");
    setReport(null);
    setAccountTermCounts({});
    setAccountDuplicateError("");
    setCheckingAccountDuplicates(false);
    if (completeFileRef.current) completeFileRef.current.value = "";
  };

  const completeContext = (): SmartImportContext => {
    if (!target) throw new Error("A lista de destino ainda não foi carregada.");
    return {
      packageName: `Importação para ${target.listName}`,
      folderName: target.folderName,
      listName: target.listName,
      frontLanguage: target.frontLanguage,
      backLanguage: target.backLanguage,
      labelA: target.labelA,
      labelB: target.labelB,
      primarySide: target.primarySide,
      studyType: target.studyType,
      ttsEnabled: target.ttsEnabled,
    };
  };

  const parseComplete = (value: string) => parseAnySmartImportSource(value, completeContext());

  const buildSimplePackage = (): SmartImportSourceResult => {
    if (!target) throw new Error("A lista de destino ainda não foi carregada.");
    const pairs = parsePastedFlashcards(raw);
    const invalid = pairs.filter((pair) => !(pair.sideA || pair.en)?.trim() || !(pair.sideB || pair.pt)?.trim());
    if (!pairs.length || invalid.length) {
      throw new Error(invalid.length
        ? `${invalid.length} linha(s) não possuem os dois lados. Use Lado A / Lado B.`
        : "Nenhum flashcard válido encontrado. Use Lado A / Lado B.");
    }

    const packageValue: SmartImportPackage = smartImportPackageSchema.parse(withSmartDeclaredTotals({
      schema: "app-piteco-super-import",
      version: "2.0",
      package: {
        name: `Flashcards simples — ${target.listName}`,
        source_language: target.frontLanguage,
        target_language: target.backLanguage,
        folders: [{
          name: target.folderName,
          lists: [{
            name: target.listName,
            front_language: target.frontLanguage,
            back_language: target.backLanguage,
            primary_side: target.primarySide,
            study_type: target.studyType,
            label_a: target.labelA,
            label_b: target.labelB,
            tts_enabled: target.ttsEnabled,
            glossary: [],
            cards: pairs.map((pair) => ({
              type: "normal" as const,
              front: (pair.sideA || pair.en || "").trim(),
              back: (pair.sideB || pair.pt || "").trim(),
              short_observation: pair.shortObservation ?? null,
              detailed_explanation: pair.detailedHint ?? null,
            })),
          }],
        }],
      },
    }));

    return { packageValue, format: "text", notes: [], warnings: [] };
  };

  const analyze = () => {
    try {
      if (!raw.trim()) throw new Error("Cole, digite ou selecione um arquivo antes de analisar.");
      const result = mode === "simple" ? buildSimplePackage() : parseComplete(raw);
      setParsed(result);
      setAccountTermCounts({});
      setAccountDuplicateError("");
      setStep(2);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Não foi possível interpretar o conteúdo.");
    }
  };

  const handleCompleteFile = async (file?: File) => {
    try {
      const text = await readCompleteImportFile(file);
      if (!text || !file) return;
      const result = parseComplete(text);
      setMode("complete");
      setRaw(text);
      setSelectedFileName(file.name);
      setParsed(result);
      setReport(null);
      setAccountTermCounts({});
      setAccountDuplicateError("");
      setStep(2);
      toast.success(`Arquivo “${file.name}” carregado e analisado.`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o arquivo JSON.");
    } finally {
      if (completeFileRef.current) completeFileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!prepared || !catalog || prepared.errors.length || duplicatePolicyBlocked) return;
    if (strategy === "replace" && !window.confirm("Os cards atuais desta lista serão substituídos. Deseja continuar?")) return;
    setBusy(true);
    setReport(null);
    try {
      const imported = await executeMappedGlobalImport(prepared.packageValue, {
        smartPackage: prepared.smartPackage,
        destinationPlan: prepared.plan,
        catalog,
        cardConflict: policy,
        onProgress: (done, total, currentLabel) => {
          setProgress(total ? (done / total) * 100 : 0);
          setProgressLabel(`${currentLabel} — ${done}/${total}`);
        },
      });
      setReport(imported);
      setProgress(100);
      setProgressLabel("Importação concluída");
      onImported();
      toast.success(`${imported.cards_created} card(s) adicionados, ${imported.cards_updated ?? 0} atualizados e ${imported.cards_skipped} ignorados.`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "A importação falhou e foi desfeita.");
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!report?.batch_id) return;
    setUndoing(true);
    try {
      await undoGlobalImport(report.batch_id);
      setReport(null);
      setProgress(0);
      setProgressLabel("");
      onImported();
      toast.success("A importação foi desfeita.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Não foi possível desfazer a importação.");
    } finally {
      setUndoing(false);
    }
  };

  const copySimplePrompt = async () => {
    await navigator.clipboard.writeText(simplePrompt);
    toast.success("Prompt padrão copiado.");
  };

  const changeMode = (next: ImportMode) => {
    setMode(next);
    setRaw("");
    setSelectedFileName("");
    setParsed(null);
    setStep(1);
    setReport(null);
    setAccountTermCounts({});
    setAccountDuplicateError("");
    setCheckingAccountDuplicates(false);
  };

  return <>
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) reset(); setOpen(next); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Upload className="mr-2 h-4 w-4" />Importar para esta lista</Button>
      </DialogTrigger>
      <DialogContent className="flex h-[92vh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>Importar para esta lista</DialogTitle>
            <Badge variant="secondary">Seguro e reversível</Badge>
          </div>
          <DialogDescription>Escolha texto rápido ou envie um pacote completo do Super Importador.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loadingTarget && <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}

          {!loadingTarget && step === 1 && target && <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <button type="button" onClick={() => changeMode("simple")} className={`rounded-xl border p-4 text-left ${mode === "simple" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/40"}`}>
                <Zap className="h-5 w-5 text-primary" />
                <div className="mt-2 font-semibold">⚡ Flashcards simples</div>
                <p className="mt-1 text-sm text-muted-foreground">Texto Lado A / Lado B, prévia e importação rápida. Sem glossário.</p>
              </button>
              <button type="button" onClick={() => changeMode("complete")} className={`rounded-xl border p-4 text-left ${mode === "complete" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/40"}`}>
                <Brain className="h-5 w-5 text-primary" />
                <div className="mt-2 font-semibold">🧠 Pacote completo</div>
                <p className="mt-1 text-sm text-muted-foreground">Arquivo JSON 2.0, cards detalhados, várias listas consolidadas e glossário da pasta.</p>
              </button>
            </div>

            {mode === "simple" && <Card className="space-y-3 p-4">
              <div>
                <h3 className="font-semibold">✨ Criar flashcards com IA</h3>
                <p className="text-sm text-muted-foreground">Lista: {target.listName} · {target.labelA} → {target.labelB}. Este modo importa somente flashcards.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={copySimplePrompt}><Clipboard className="mr-2 h-4 w-4" />Copiar prompt padrão</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowSimplePrompt((value) => !value)}><Eye className="mr-2 h-4 w-4" />Visualizar prompt</Button>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 font-mono text-xs">Hello / Olá<br />Could / Poderia (verbo modal) [Explicação opcional]</div>
              {showSimplePrompt && <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border bg-background p-3 text-xs">{simplePrompt}</pre>}
            </Card>}

            {mode === "complete" && <Card className="space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Prompt e arquivo do Super Importador</h3>
                  <p className="text-sm text-muted-foreground">Cole o JSON abaixo ou selecione diretamente o arquivo recebido da IA.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setPromptOpen(true)}>Configurar prompt</Button>
                  <input
                    ref={completeFileRef}
                    type="file"
                    accept={COMPLETE_IMPORT_FILE_ACCEPT}
                    className="hidden"
                    onChange={(event) => void handleCompleteFile(event.target.files?.[0])}
                  />
                  <Button type="button" onClick={() => completeFileRef.current?.click()} disabled={busy}>
                    <FileJson2 className="mr-2 h-4 w-4" />Selecionar arquivo JSON
                  </Button>
                </div>
              </div>
              <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">Aceita arquivo <strong>.json</strong> de até 50 MB. O arquivo é analisado antes de qualquer gravação.</p>
            </Card>}

            <div className="space-y-2">
              <Label>{mode === "simple" ? "Flashcards" : "Pacote completo — colagem opcional"}</Label>
              <Textarea
                value={raw}
                onChange={(event) => { setRaw(event.target.value); setSelectedFileName(""); }}
                className="min-h-[320px] font-mono text-xs sm:text-sm"
                placeholder={mode === "simple"
                  ? "Hello / Olá\nGood morning / Bom dia"
                  : "Cole o JSON app-piteco-super-import 2.0 ou use o botão Selecionar arquivo JSON..."}
              />
            </div>
          </div>}

          {step === 2 && prepared && reviewParsed && reconciliation && <div className="space-y-4">
            {selectedFileName && <Badge variant="outline" className="gap-1"><FileJson2 className="h-3.5 w-3.5" />{selectedFileName}</Badge>}
            {reviewParsed.notes.length > 0 && <Alert><AlertDescription>{reviewParsed.notes.join(" ")}</AlertDescription></Alert>}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              <Metric value={prepared.summary.sourceLists} label="Listas recebidas" />
              <Metric value={reconciliation.cardsReceived} label="Cards recebidos" />
              <Metric value={reconciliation.cardsValid} label="Válidos e únicos" />
              <Metric value={reconciliation.cardsDuplicates} label="Duplicados" />
              <Metric value={reconciliation.cardsBlocked} label="Bloqueados" />
              <Metric value={prepared.summary.glossaryToImport} label="Glossário" />
              <Card className="p-3 text-center"><div className="truncate text-sm font-bold">{prepared.target.listName}</div><div className="text-xs text-muted-foreground">Destino</div></Card>
            </div>
            <Card className={`p-4 text-sm ${reconciliation.coherent ? "bg-primary/5" : "border-destructive bg-destructive/5 text-destructive"}`}>
              {reconciliation.cardsReceived} recebidos = {reconciliation.cardsValid} válidos + {reconciliation.cardsDuplicates} duplicados + {reconciliation.cardsBlocked} bloqueados.
            </Card>
            {checkingAccountDuplicates && <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checando termos em todas as listas e espaços do seu perfil...</Card>}
            {!checkingAccountDuplicates && accountDuplicateError && <Alert><AlertDescription>Checagem geral indisponível: {accountDuplicateError}</AlertDescription></Alert>}
            {!checkingAccountDuplicates && !accountDuplicateError && accountDuplicateTerms > 0 && <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm">
              <strong>{accountDuplicateTerms.toLocaleString("pt-BR")} termo(s)</strong> já aparecem em alguma lista ou espaço do seu perfil. Eles ficam marcados em vermelho abaixo.
            </Card>}
            {prepared.errors.map((error) => <Alert key={error} variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>)}
            {prepared.sourceGroups.length > 1 && <Card className="p-4">
              <h3 className="mb-2 font-semibold">Grupos de origem</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                {prepared.sourceGroups.map((group, index) => <div key={`${group.folderName}-${group.listName}-${index}`} className="flex flex-wrap items-center gap-2">
                  <span>{group.folderName} / {group.listName} — {group.cards} card(s)</span>
                  {group.blocked && <Badge variant="destructive">Lados incompatíveis</Badge>}
                </div>)}
              </div>
            </Card>}
            <ReviewPanel
              parsed={reviewParsed}
              accountTermCounts={accountTermCounts}
              loadingAccountDuplicates={checkingAccountDuplicates}
              accountDuplicateError={accountDuplicateError}
            />
          </div>}

          {step === 3 && prepared && reconciliation && <div className="mx-auto max-w-2xl space-y-4">
            <Card className="space-y-3 p-4">
              <div>
                <Label>Estratégia da lista</Label>
                <Select value={strategy} onValueChange={(value) => setStrategy(value as ExistingListImportStrategy)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="append">Adicionar aos cards atuais</SelectItem><SelectItem value="replace">Substituir conteúdo da lista</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Política de duplicados</Label>
                <Select value={policy} onValueChange={(value) => setPolicy(value as CardConflictPolicy)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="skip">Ignorar duplicados</SelectItem><SelectItem value="replace">Atualizar o card existente</SelectItem><SelectItem value="copy">Manter os dois</SelectItem><SelectItem value="error">Bloquear se houver duplicado</SelectItem></SelectContent>
                </Select>
              </div>
            </Card>
            {duplicatePolicyBlocked && <Alert variant="destructive"><AlertDescription>Há {reconciliation.cardsDuplicates} card(s) duplicado(s). Escolha outra política ou remova os duplicados antes de importar.</AlertDescription></Alert>}
            <Card className="p-4 text-sm text-muted-foreground">
              <strong className="text-foreground">Destino:</strong> {prepared.target.folderName} / {prepared.target.listName}<br />
              <strong className="text-foreground">Direção preservada:</strong> {prepared.target.labelA} → {prepared.target.labelB}<br />
              <strong className="text-foreground">Reconciliação:</strong> {reconciliation.cardsReceived} = {reconciliation.cardsValid} + {reconciliation.cardsDuplicates} + {reconciliation.cardsBlocked}.<br />
              <strong className="text-foreground">Glossário:</strong> {prepared.summary.glossaryToImport} entrada(s) consolidadas na pasta.
            </Card>
            {(busy || report) && <div><Progress value={progress} /><p className="mt-1 text-center text-xs text-muted-foreground">{progressLabel}</p></div>}
            {report && <Alert><Check className="h-4 w-4" /><AlertDescription>Importação concluída: {report.cards_created} criado(s), {report.cards_updated ?? 0} atualizado(s), {report.cards_skipped} ignorado(s) e {report.glossary_created ?? 0} entrada(s) de glossário.</AlertDescription></Alert>}
          </div>}
        </div>

        <DialogFooter className="border-t p-4">
          <div className="flex w-full flex-wrap justify-between gap-2">
            <Button variant="ghost" disabled={busy || undoing} onClick={() => step === 1 ? setOpen(false) : setStep((step - 1) as Step)}>
              <ArrowLeft className="mr-2 h-4 w-4" />{step === 1 ? "Cancelar" : "Voltar"}
            </Button>
            <div className="flex flex-wrap gap-2">
              {report && <Button variant="outline" disabled={undoing} onClick={undo}>{undoing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}Desfazer</Button>}
              {step === 1 && <Button disabled={!raw.trim() || loadingTarget} onClick={analyze}>Analisar<ArrowRight className="ml-2 h-4 w-4" /></Button>}
              {step === 2 && <Button disabled={Boolean(prepared?.errors.length)} onClick={() => setStep(3)}>Continuar<ArrowRight className="ml-2 h-4 w-4" /></Button>}
              {step === 3 && !report && <Button disabled={busy || Boolean(prepared?.errors.length) || duplicatePolicyBlocked} onClick={save}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Importar</Button>}
              {report && <Button onClick={() => setOpen(false)}>Concluir</Button>}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <SmartPromptDialog open={promptOpen} onOpenChange={setPromptOpen} value={options} onChange={setOptions} />
  </>;
}

function Metric({ value, label }: { value: number; label: string }) {
  return <Card className="p-3 text-center"><div className="text-xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></Card>;
}
