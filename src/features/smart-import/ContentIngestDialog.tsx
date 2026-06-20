import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { firstSmartList } from "./adapters";
import { importSmartListIntoExistingList, type SmartDuplicatePolicy } from "./localService";
import { parseAnySmartImportSource } from "./parseAnySource";
import type { SmartImportPromptOptions } from "./prompt";
import { ConfirmPanel, ReviewPanel } from "./ReviewPanel";
import type { SmartImportSourceResult } from "./sourceParser";
import { SmartImportSourceStep } from "./SmartImportSourceStep";
import { SmartPromptDialog } from "./SmartPromptDialog";

interface Props {
  listId: string;
  onImported: () => void;
  labelA?: string;
  labelB?: string;
  langA?: string;
  langB?: string;
}

export function ContentIngestDialog({ listId, onImported, labelA = "Lado A", labelB = "Lado B", langA = "en", langB = "pt-BR" }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<SmartImportSourceResult | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [policy, setPolicy] = useState<SmartDuplicatePolicy>("skip");
  const [invert, setInvert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [options, setOptions] = useState<SmartImportPromptOptions>({ languageA: langA, languageB: langB, outputFormat: "json" });

  const reset = () => { setStep(1); setRaw(""); setParsed(null); setProgress(0); setProgressLabel(""); };
  const analyze = () => {
    try {
      setParsed(parseAnySmartImportSource(raw, { frontLanguage: langA, backLanguage: langB, labelA, labelB }));
      setStep(2);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Não foi possível interpretar o conteúdo.");
    }
  };
  const save = async () => {
    const list = parsed ? firstSmartList(parsed.packageValue) : null;
    if (!list) return;
    setBusy(true);
    try {
      const report = await importSmartListIntoExistingList({
        listId,
        list,
        duplicatePolicy: policy,
        invertSides: invert,
        onProgress: (done, total, label) => {
          setProgress(total ? (done / total) * 100 : 0);
          setProgressLabel(`${label} — ${done}/${total}`);
        },
      });
      toast.success(`${report.cardsCreated} card(s), ${report.glossaryCreated} termo(s) e ${report.layeredGroupsCreated} grupo(s) adicionados.`);
      onImported();
      setOpen(false);
      reset();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "A importação falhou.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) reset(); setOpen(next); }}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><Upload className="mr-2 h-4 w-4" />Importar</Button></DialogTrigger>
      <DialogContent className="flex h-[90vh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4"><div className="flex items-center gap-2"><DialogTitle>Importação inteligente</DialogTitle><Badge variant="secondary">2.0</Badge></div><DialogDescription>Texto, CSV ou JSON com revisão antes de salvar.</DialogDescription></DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === 1 && <SmartImportSourceStep value={raw} onChange={setRaw} onConfigure={() => setPromptOpen(true)} />}
          {step === 2 && parsed && <ReviewPanel parsed={parsed} />}
          {step === 3 && parsed && <div className="mx-auto max-w-2xl space-y-4"><ConfirmPanel value={parsed.packageValue} /><div className="space-y-3 rounded-xl border p-4"><Label>Cards repetidos</Label><Select value={policy} onValueChange={(value) => setPolicy(value as SmartDuplicatePolicy)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="skip">Ignorar</SelectItem><SelectItem value="copy">Criar cópia</SelectItem><SelectItem value="error">Bloquear</SelectItem></SelectContent></Select><div className="flex items-center justify-between"><Label>Inverter A ↔ B</Label><Switch checked={invert} onCheckedChange={setInvert} /></div></div>{busy && <div><Progress value={progress} /><p className="mt-1 text-center text-xs text-muted-foreground">{progressLabel}</p></div>}</div>}
        </div>
        <DialogFooter className="border-t p-4"><div className="flex w-full justify-between"><Button variant="ghost" disabled={busy} onClick={() => step === 1 ? setOpen(false) : setStep((step - 1) as 1 | 2)}><ArrowLeft className="mr-2 h-4 w-4" />{step === 1 ? "Cancelar" : "Voltar"}</Button>{step === 1 && <Button disabled={!raw.trim()} onClick={analyze}>Analisar<ArrowRight className="ml-2 h-4 w-4" /></Button>}{step === 2 && <Button onClick={() => setStep(3)}>Continuar<ArrowRight className="ml-2 h-4 w-4" /></Button>}{step === 3 && <Button disabled={busy} onClick={save}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Salvar</Button>}</div></DialogFooter>
      </DialogContent>
    </Dialog>
    <SmartPromptDialog open={promptOpen} onOpenChange={setPromptOpen} value={options} onChange={setOptions} />
  </>;
}
