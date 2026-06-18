import { useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, FolderTree, Loader2, RotateCcw, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DestinationMappingCard } from "./components/DestinationMappingCard";
import { PromptBuilderCard } from "./components/PromptBuilderCard";
import {
  buildDefaultDestinationPlan,
  loadImportDestinationCatalog,
  validateDestinationPlan,
  type GlobalImportDestinationPlan,
  type ImportDestinationCatalog,
} from "./destination";
import {
  executeMappedGlobalImport,
  undoGlobalImport,
  type CardConflictPolicy,
  type GlobalImportExecutionReport,
} from "./mappedService";
import { parseGlobalImportText } from "./parser";
import { GLOBAL_IMPORT_LIMITS } from "./schema";
import { validateGlobalImportPackage, type GlobalImportValidationResult } from "./checks";

export default function SuperGlobalImportScreen() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [validation, setValidation] = useState<GlobalImportValidationResult | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<ImportDestinationCatalog | null>(null);
  const [destinationPlan, setDestinationPlan] = useState<GlobalImportDestinationPlan | null>(null);
  const [cardConflict, setCardConflict] = useState<CardConflictPolicy>("skip");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [report, setReport] = useState<GlobalImportExecutionReport | null>(null);
  const [undoing, setUndoing] = useState(false);

  const resetAnalysis = (nextRaw: string) => {
    setRaw(nextRaw);
    setValidation(null);
    setNotes([]);
    setCatalog(null);
    setDestinationPlan(null);
    setReport(null);
    setProgress(0);
    setProgressText("");
  };

  const analyze = async (text = raw) => {
    try {
      const parsed = parseGlobalImportText(text);
      const result = validateGlobalImportPackage(parsed.value);
      const nextNotes: string[] = [];
      if (parsed.extracted) nextNotes.push("O JSON foi extraído do texto ao redor.");
      if (parsed.repaired) nextNotes.push("Vírgulas finais inválidas foram removidas com segurança.");
      setRaw(text);
      setValidation(result);
      setNotes(nextNotes);
      setReport(null);

      if (!result.valid || !result.package) {
        setCatalog(null);
        setDestinationPlan(null);
        toast.error("O pacote possui erros bloqueantes.");
        return;
      }

      const nextCatalog = await loadImportDestinationCatalog();
      setCatalog(nextCatalog);
      setDestinationPlan(buildDefaultDestinationPlan(result.package, nextCatalog));
      toast.success("Pacote válido. Agora escolha os destinos da estrutura.");
    } catch (error: any) {
      setValidation(null);
      setCatalog(null);
      setDestinationPlan(null);
      toast.error(error?.message || "Não foi possível analisar o pacote.");
    }
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    if (file.size > GLOBAL_IMPORT_LIMITS.maxFileBytes) {
      toast.error("O arquivo excede 5 MB.");
      return;
    }
    try {
      const text = await file.text();
      resetAnalysis(text);
      await analyze(text);
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  };

  const importPackage = async () => {
    if (!validation?.valid || !validation.package || !catalog || !destinationPlan) return;
    const destinationErrors = validateDestinationPlan(validation.package, catalog, destinationPlan);
    if (destinationErrors.length) {
      toast.error(destinationErrors[0]);
      return;
    }

    setBusy(true);
    setProgress(0);
    setProgressText("Preparando a importação...");
    try {
      const imported = await executeMappedGlobalImport(validation.package, {
        destinationPlan,
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

  const undo = async () => {
    if (!report?.batch_id) return;
    setUndoing(true);
    try {
      await undoGlobalImport(report.batch_id);
      toast.success("A importação foi desfeita.");
      setReport(null);
      setProgress(0);
      setProgressText("");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível desfazer a importação.");
    } finally {
      setUndoing(false);
    }
  };

  const errors = validation?.issues.filter((issue) => issue.severity === "error") ?? [];
  const warnings = validation?.issues.filter((issue) => issue.severity === "warning") ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 pb-24">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold">Super Importador Global</h1>
              <Badge variant="secondary">Schema V1</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              Importe qualquer conjunto de pastas, listas e frases preservando exatamente os vínculos declarados no pacote.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/import")}>Importador simples</Button>
        </header>

        <PromptBuilderCard />

        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Label htmlFor="global-import-json">Pacote JSON</Label>
              <p className="text-sm text-muted-foreground">Cole a resposta da IA ou carregue JSON/TXT de até 5 MB.</p>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".json,.txt,application/json,text/plain"
                className="hidden"
                onChange={(event) => {
                  loadFile(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Upload className="mr-2 h-4 w-4" />Arquivo
              </Button>
            </div>
          </div>
          <Textarea
            id="global-import-json"
            value={raw}
            onChange={(event) => resetAnalysis(event.target.value)}
            className="min-h-64 font-mono text-xs"
            disabled={busy}
            placeholder='{"schema":"appteco-global-import","version":1,"package":{...}}'
          />
          <Button className="w-full" onClick={() => analyze()} disabled={!raw.trim() || busy}>
            Validar e preparar destinos
          </Button>
        </Card>

        {validation && (
          <>
            <Card className="p-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{validation.summary.folders} pasta(s)</Badge>
                <Badge variant="outline">{validation.summary.lists} lista(s)</Badge>
                <Badge variant="outline">{validation.summary.cards} card(s)</Badge>
                {errors.length ? <Badge variant="destructive">{errors.length} erro(s)</Badge> : <Badge>Estrutura válida</Badge>}
                {warnings.length ? <Badge variant="secondary">{warnings.length} aviso(s)</Badge> : null}
              </div>
              {notes.map((note) => <p key={note} className="mt-2 text-xs text-muted-foreground">ℹ️ {note}</p>)}
            </Card>

            {validation.issues.length > 0 && (
              <Card className="space-y-3 p-5">
                <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Validação</h2>
                <ScrollArea className="max-h-56">
                  <div className="space-y-2 pr-3">
                    {validation.issues.map((issue, index) => (
                      <div key={`${issue.path}-${issue.code}-${index}`} className="rounded border p-3 text-sm">
                        <div className="font-mono text-xs text-muted-foreground">{issue.path}</div>
                        <div>{issue.message}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            )}

            {validation.package && (
              <Card className="space-y-4 p-5">
                <h2 className="flex items-center gap-2 font-semibold"><FolderTree className="h-4 w-4" />Prévia: {validation.package.package.name}</h2>
                <div className="space-y-3">
                  {validation.package.package.folders.map((folder, folderIndex) => (
                    <details key={`${folder.name}-${folderIndex}`} open className="rounded-lg border p-3">
                      <summary className="cursor-pointer font-semibold">
                        {folder.name} — {folder.lists.reduce((sum, list) => sum + list.cards.length, 0)} cards
                      </summary>
                      <div className="mt-3 space-y-2 pl-3">
                        {folder.lists.map((list, listIndex) => (
                          <details key={`${list.name}-${listIndex}`} className="rounded-md bg-muted/40 p-3">
                            <summary className="cursor-pointer">{list.name}: {list.cards.length} cards</summary>
                            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                              {list.cards.slice(0, 10).map((card, cardIndex) => (
                                <div key={`${card.front}-${cardIndex}`}>{cardIndex + 1}. {card.front} → {card.back}</div>
                              ))}
                              {list.cards.length > 10 && <div>… mais {list.cards.length - 10} card(s)</div>}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {validation?.valid && validation.package && catalog && destinationPlan && !report && (
          <>
            <DestinationMappingCard
              packageValue={validation.package}
              catalog={catalog}
              plan={destinationPlan}
              onChange={setDestinationPlan}
            />

            <Card className="space-y-4 p-5">
              <div>
                <Label>Quando o mesmo card já existir na lista escolhida</Label>
                <Select value={cardConflict} onValueChange={(value) => setCardConflict(value as CardConflictPolicy)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Ignorar o duplicado</SelectItem>
                    <SelectItem value="copy">Criar outra cópia</SelectItem>
                    <SelectItem value="error">Cancelar toda a importação</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {busy && (
                <div className="space-y-2">
                  <p className="text-sm">{progressText}</p>
                  <Progress value={progress} />
                </div>
              )}

              <Button className="h-12 w-full" onClick={importPackage} disabled={busy}>
                {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</> : `Importar ${validation.summary.cards} cards`}
              </Button>
            </Card>
          </>
        )}

        {report && (
          <Card className="border-primary/30 p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold"><CheckCircle2 className="h-5 w-5 text-primary" />Importação concluída</h2>
            <p className="mt-1 text-muted-foreground">Pacote: {report.package_name}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric value={report.folders_created} label="Pastas criadas" />
              <Metric value={report.lists_created} label="Listas criadas" />
              <Metric value={report.cards_created} label="Cards criados" />
              <Metric value={report.cards_skipped} label="Duplicados ignorados" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => navigate("/folders")}>Abrir minhas pastas</Button>
              <Button variant="outline" onClick={undo} disabled={undoing}>
                {undoing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                Desfazer esta importação
              </Button>
            </div>
          </Card>
        )}
      </div>
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
