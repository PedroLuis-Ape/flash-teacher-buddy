import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Download, FileJson, FileSpreadsheet, Sparkles, Upload } from "lucide-react";
import type { SpecialFlashcardDetail } from "@/hooks/useSpecialFlashcards";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  buildSpecialExportBatches,
  buildSpecialPrompt,
  copyText,
  saveSpecialExportManifest,
  type SpecialExportPackage,
} from "../lib/protocol";
import {
  buildSpecialCsvExport,
  buildSpecialCsvPrompt,
  specialCsvFilename,
  specialCsvPromptFilename,
} from "../lib/csvProtocol";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: SpecialFlashcardDetail[];
}

function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function persist(batch: SpecialExportPackage): void {
  saveSpecialExportManifest(batch);
}

export default function SpecialExportDialog({ open, onOpenChange, cards }: Props) {
  const [batchSize, setBatchSize] = useState(20);
  const [activeIndex, setActiveIndex] = useState(0);
  const batches = useMemo(
    () => open && cards.length > 0 ? buildSpecialExportBatches(cards, batchSize) : [],
    [batchSize, cards, open],
  );
  const current = batches[activeIndex] ?? null;

  useEffect(() => setActiveIndex(0), [batchSize, cards]);

  const handleDownloadCsv = () => {
    if (!current) return;
    persist(current);
    downloadText(
      specialCsvFilename(current),
      `\uFEFF${buildSpecialCsvExport(current)}`,
      "text/csv;charset=utf-8",
    );
    toast.success(`CSV do lote ${current.batch_index} baixado.`);
  };

  const handleCopyPrompt = async () => {
    if (!current) return;
    persist(current);
    const copied = await copyText(buildSpecialCsvPrompt(current));
    toast[copied ? "success" : "error"](
      copied ? "Prompt para a IA copiado." : "Não foi possível copiar o prompt.",
    );
  };

  const handleDownloadPrompt = () => {
    if (!current) return;
    persist(current);
    downloadText(
      specialCsvPromptFilename(current),
      buildSpecialCsvPrompt(current),
      "text/plain;charset=utf-8",
    );
    toast.success("Prompt baixado.");
  };

  const handleLegacyJson = () => {
    if (!current) return;
    persist(current);
    downloadText(
      `ape-especiais-legado-${current.export_id}.json`,
      JSON.stringify(current, null, 2),
      "application/json;charset=utf-8",
    );
    toast.success("JSON legado baixado.");
  };

  const handleLegacyPrompt = async () => {
    if (!current) return;
    persist(current);
    const copied = await copyText(buildSpecialPrompt(current));
    toast[copied ? "success" : "error"](
      copied ? "Prompt legado copiado." : "Não foi possível copiar.",
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-sky-500" />
            Preparar Cards Especiais para a IA
          </DialogTitle>
          <DialogDescription>
            Baixe o CSV, envie junto com o prompt e depois importe o arquivo preenchido.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border bg-sky-50/70 p-3 dark:bg-sky-950/20">
            <div className="flex items-center gap-2 font-medium"><FileSpreadsheet className="h-4 w-4 text-sky-600" />1. Baixe o CSV</div>
            <p className="mt-1 text-xs text-muted-foreground">Ele contém os cards e os identificadores protegidos.</p>
          </div>
          <div className="rounded-xl border bg-violet-50/70 p-3 dark:bg-violet-950/20">
            <div className="flex items-center gap-2 font-medium"><Copy className="h-4 w-4 text-violet-600" />2. Copie o prompt</div>
            <p className="mt-1 text-xs text-muted-foreground">Envie o prompt e o CSV na mesma conversa com a IA.</p>
          </div>
          <div className="rounded-xl border bg-emerald-50/70 p-3 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 font-medium"><Upload className="h-4 w-4 text-emerald-600" />3. Importe a resposta</div>
            <p className="mt-1 text-xs text-muted-foreground">O app confere tudo antes de aplicar.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3">
          <div className="text-sm font-medium">Cards por lote</div>
          <Select value={String(batchSize)} onValueChange={(value) => setBatchSize(Number(value))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 50].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
            </SelectContent>
          </Select>
          <Badge variant="secondary">{cards.length} card(s)</Badge>
          <Badge variant="outline">{batches.length} lote(s)</Badge>
        </div>

        {current && <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} disabled={activeIndex === 0}>
              <ChevronLeft className="h-4 w-4" />Anterior
            </Button>
            <div className="text-center">
              <div className="font-medium">Lote {current.batch_index} de {current.batch_count}</div>
              <div className="text-xs text-muted-foreground">{current.card_count} card(s) · {current.export_id}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setActiveIndex((index) => Math.min(batches.length - 1, index + 1))} disabled={activeIndex >= batches.length - 1}>
              Próximo<ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button size="lg" onClick={handleDownloadCsv} className="h-auto min-h-16 justify-start px-4 py-3 text-left">
              <FileSpreadsheet className="mr-3 h-6 w-6" />
              <span><span className="block font-semibold">Baixar CSV para a IA</span><span className="block text-xs font-normal opacity-80">Arquivo principal deste lote</span></span>
            </Button>
            <Button size="lg" variant="secondary" onClick={handleCopyPrompt} className="h-auto min-h-16 justify-start px-4 py-3 text-left">
              <Copy className="mr-3 h-6 w-6" />
              <span><span className="block font-semibold">Copiar prompt para a IA</span><span className="block text-xs font-normal opacity-80">Cole junto com o CSV</span></span>
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Prompt deste lote</div>
              <Button variant="outline" size="sm" onClick={handleDownloadPrompt}><Download className="mr-1 h-4 w-4" />Baixar prompt</Button>
            </div>
            <Textarea readOnly value={buildSpecialCsvPrompt(current)} className="min-h-[180px] font-mono text-[11px]" />
          </div>

          <details className="rounded-lg border bg-muted/20 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-muted-foreground">Compatibilidade com o formato antigo</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleLegacyJson}><FileJson className="mr-1 h-4 w-4" />Baixar JSON legado</Button>
              <Button variant="outline" size="sm" onClick={handleLegacyPrompt}><Copy className="mr-1 h-4 w-4" />Copiar prompt legado</Button>
            </div>
          </details>
        </div>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
