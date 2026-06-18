import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clipboard, FileJson, FolderTree, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { parseGlobalImportText } from "@/features/global-import/parser";
import { validateGlobalImportPackage, type GlobalImportValidationResult } from "@/features/global-import/checks";
import { buildGlobalImportPrompt } from "@/features/global-import/prompt";
import { GLOBAL_IMPORT_EXAMPLE, GLOBAL_IMPORT_LIMITS } from "@/features/global-import/schema";

type ConflictPolicy = "use_existing" | "numbered" | "error";
type CardConflictPolicy = "skip" | "copy" | "error";

interface ImportReport {
  batch_id: string;
  package_name: string;
  folders_created: number;
  folders_reused: number;
  lists_created: number;
  lists_reused: number;
  cards_created: number;
  cards_skipped: number;
}

export default function SuperGlobalImport() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [validation, setValidation] = useState<GlobalImportValidationResult | null>(null);
  const [parseNotes, setParseNotes] = useState<string[]>([]);
  const [folderPolicy, setFolderPolicy] = useState<ConflictPolicy>("use_existing");
  const [listPolicy, setListPolicy] = useState<ConflictPolicy>("use_existing");
  const [cardPolicy, setCardPolicy] = useState<CardConflictPolicy>("skip");
  const [isImporting, setIsImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const errors = useMemo(
    () => validation?.issues.filter((issue) => issue.severity === "error") ?? [],
    [validation],
  );
  const warnings = useMemo(
    () => validation?.issues.filter((issue) => issue.severity === "warning") ?? [],
    [validation],
  );

  const analyze = (text = raw) => {
    try {
      const parsed = parseGlobalImportText(text);
      const result = validateGlobalImportPackage(parsed.value);
      const notes: string[] = [];
      if (parsed.extracted) notes.push("O JSON foi extraído de texto ou Markdown ao redor.");
      if (parsed.repaired) notes.push("Vírgulas finais inválidas foram removidas com segurança.");
      setParseNotes(notes);
      setValidation(result);
      setReport(null);
      if (result.valid) toast.success("Pacote válido e pronto para pré-visualização.");
      else toast.error(`${result.issues.filter((issue) => issue.severity === "error").length} erro(s) bloqueante(s) encontrado(s).`);
    } catch (error: any) {
      setValidation(null);
      setParseNotes([]);
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
      setRaw(text);
      analyze(text);
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  };

  const copyExamplePrompt = async () => {
    const prompt = buildGlobalImportPrompt({
      packageName: "Emoções Básicas",
      sourceLanguage: "inglês",
      targetLanguage: "português do Brasil",
      level: "A2",
      theme: "emoções básicas",
      includeExamples: true,
      folders: ["Amor", "Ódio", "Felicidade"].map((name) => ({
        name,
        lists: [{ name: "Vocabulário principal", cardCount: 10 }],
      })),
      allowRepetitions: false,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt de exemplo copiado.");
    } catch {
      toast.error("Não foi possível copiar o prompt.");
    }
  };

  const importPackage = async () => {
    if (!validation?.valid || !validation.package) return;
    setIsImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Você precisa estar logado.");

      const { data, error } = await (supabase.rpc as any)("import_global_package_v1", {
        _payload: validation.package,
        _folder_conflict: folderPolicy,
        _list_conflict: listPolicy,
        _card_conflict: cardPolicy,
        _institution_id: null,
      });
      if (error) throw error;
      setReport(data as ImportReport);
      toast.success("Importação global concluída sem dados parciais.");
    } catch (error: any) {
      toast.error(error?.message || "A importação falhou e foi revertida.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 pb-24">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold">Super Importador Global</h1>
              <Badge variant="secondary">Schema V1</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              Crie várias pastas, listas e cards em uma única operação transacional.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/import")}>Importador simples</Button>
        </div>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Criar conteúdo com IA</h2>
              <p className="text-sm text-muted-foreground">Copie um prompt compatível com o mesmo schema usado pelo validador.</p>
            </div>
            <Button variant="outline" onClick={copyExamplePrompt}><Clipboard className="mr-2 h-4 w-4" />Copiar exemplo Amor–Ódio–Felicidade</Button>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Label htmlFor="global-json" className="text-base font-semibold">Pacote JSON</Label>
              <p className="text-sm text-muted-foreground">Cole a resposta da IA ou carregue um arquivo JSON/TXT de até 5 MB.</p>
            </div>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" className="hidden" onChange={(event) => { loadFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
              <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Arquivo</Button>
              <Button variant="outline" onClick={() => { const example = JSON.stringify(GLOBAL_IMPORT_EXAMPLE, null, 2); setRaw(example); analyze(example); }}><FileJson className="mr-2 h-4 w-4" />Carregar exemplo</Button>
            </div>
          </div>
          <Textarea id="global-json" value={raw} onChange={(event) => { setRaw(event.target.value); setValidation(null); setReport(null); }} className="min-h-[260px] font-mono text-xs" placeholder='{"schema":"appteco-global-import","version":1,"package":{...}}' />
          <Button onClick={() => analyze()} disabled={!raw.trim()} className="w-full">Validar e gerar prévia</Button>
        </Card>

        {validation && (
          <>
            <Card className="p-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{validation.summary.folders} pasta(s)</Badge>
                <Badge variant="outline">{validation.summary.lists} lista(s)</Badge>
                <Badge variant="outline">{validation.summary.cards} card(s)</Badge>
                {errors.length === 0 ? <Badge className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Pronto</Badge> : <Badge variant="destructive">{errors.length} erro(s)</Badge>}
                {warnings.length > 0 && <Badge variant="secondary">{warnings.length} aviso(s)</Badge>}
              </div>
              {parseNotes.map((note) => <p key={note} className="mt-2 text-xs text-muted-foreground">ℹ️ {note}</p>)}
            </Card>

            {validation.issues.length > 0 && (
              <Card className="p-5 space-y-3">
                <h2 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Validação</h2>
                <ScrollArea className="max-h-56">
                  <div className="space-y-2 pr-3">
                    {validation.issues.map((issue, index) => (
                      <div key={`${issue.path}-${issue.code}-${index}`} className={`rounded-md border p-3 text-sm ${issue.severity === "error" ? "border-destructive/40 bg-destructive/5" : "border-amber-500/40 bg-amber-500/5"}`}>
                        <div className="font-mono text-xs text-muted-foreground">{issue.path}</div>
                        <div>{issue.message}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            )}

            {validation.package && (
              <Card className="p-5 space-y-4">
                <h2 className="font-semibold flex items-center gap-2"><FolderTree className="h-4 w-4" />Prévia: {validation.package.package.name}</h2>
                <div className="space-y-3">
                  {validation.package.package.folders.map((folder, folderIndex) => (
                    <details key={`${folder.name}-${folderIndex}`} open className="rounded-lg border p-3">
                      <summary className="cursor-pointer font-semibold">{folder.name} — {folder.lists.reduce((sum, list) => sum + list.cards.length, 0)} cards</summary>
                      <div className="mt-3 space-y-2 pl-3">
                        {folder.lists.map((list, listIndex) => (
                          <details key={`${list.name}-${listIndex}`} className="rounded-md bg-muted/40 p-3">
                            <summary className="cursor-pointer">{list.name}: {list.cards.length} cards</summary>
                            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                              {list.cards.slice(0, 10).map((card, cardIndex) => <div key={`${card.front}-${cardIndex}`}>{cardIndex + 1}. {card.front} → {card.back}</div>)}
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

            {validation.valid && validation.package && !report && (
              <Card className="p-5 space-y-4">
                <h2 className="font-semibold">Conflitos</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <div><Label>Se a pasta existir</Label><Select value={folderPolicy} onValueChange={(value) => setFolderPolicy(value as ConflictPolicy)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="use_existing">Usar existente</SelectItem><SelectItem value="numbered">Criar nome numerado</SelectItem><SelectItem value="error">Cancelar</SelectItem></SelectContent></Select></div>
                  <div><Label>Se a lista existir</Label><Select value={listPolicy} onValueChange={(value) => setListPolicy(value as ConflictPolicy)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="use_existing">Usar existente</SelectItem><SelectItem value="numbered">Criar nome numerado</SelectItem><SelectItem value="error">Cancelar</SelectItem></SelectContent></Select></div>
                  <div><Label>Se o card existir</Label><Select value={cardPolicy} onValueChange={(value) => setCardPolicy(value as CardConflictPolicy)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="skip">Ignorar duplicado</SelectItem><SelectItem value="copy">Criar cópia</SelectItem><SelectItem value="error">Cancelar</SelectItem></SelectContent></Select></div>
                </div>
                <Button onClick={importPackage} disabled={isImporting} className="w-full h-12 text-base">{isImporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando com transação...</> : `Confirmar importação de ${validation.summary.cards} cards`}</Button>
              </Card>
            )}
          </>
        )}

        {report && (
          <Card className="p-6 border-primary/30">
            <h2 className="text-xl font-bold flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />Importação concluída</h2>
            <p className="mt-1 text-muted-foreground">Pacote: {report.package_name}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-muted p-3"><div className="text-xl font-bold">{report.folders_created}</div><div className="text-xs text-muted-foreground">Pastas criadas</div></div>
              <div className="rounded-lg bg-muted p-3"><div className="text-xl font-bold">{report.lists_created}</div><div className="text-xs text-muted-foreground">Listas criadas</div></div>
              <div className="rounded-lg bg-muted p-3"><div className="text-xl font-bold">{report.cards_created}</div><div className="text-xs text-muted-foreground">Cards criados</div></div>
              <div className="rounded-lg bg-muted p-3"><div className="text-xl font-bold">{report.cards_skipped}</div><div className="text-xs text-muted-foreground">Duplicados ignorados</div></div>
            </div>
            <Button className="mt-5" onClick={() => navigate("/folders")}>Abrir minhas pastas</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
