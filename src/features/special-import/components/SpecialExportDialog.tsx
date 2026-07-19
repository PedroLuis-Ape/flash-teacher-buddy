import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
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
import { appendPreferredJsonFileDelivery } from "@/lib/aiJsonFileDelivery";
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
} from "../lib/csvProtocol";
import {
  buildSpecialV3Batches,
  buildSpecialV3Txt,
  saveSpecialV3Manifest,
  specialV3TxtFilename,
  type SpecialV3ExportBatch,
} from "../lib/v3Protocol";

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

function persistLegacy(batch: SpecialExportPackage): void {
  saveSpecialExportManifest(batch);
}

function persistV3(batch: SpecialV3ExportBatch): boolean {
  return Boolean(saveSpecialV3Manifest(batch));
}

function resultFilename(batch: SpecialV3ExportBatch): string {
  return `piteco-cards-especiais-resposta-lote-${String(batch.batch_index).padStart(2, "0")}-de-${String(batch.batch_count).padStart(2, "0")}.json`;
}

export default function SpecialExportDialog({ open, onOpenChange, cards }: Props) {
  const [batchSize, setBatchSize] = useState(20);
  const [activeIndex, setActiveIndex] = useState(0);
  const batches = useMemo(
    () => open && cards.length > 0 ? buildSpecialV3Batches(cards, batchSize) : [],
    [batchSize, cards, open],
  );
  const legacyBatches = useMemo(
    () => open && cards.length > 0 ? buildSpecialExportBatches(cards, batchSize) : [],
    [batchSize, cards, open],
  );
  const current = batches[activeIndex] ?? null;
  const legacyCurrent = legacyBatches[activeIndex] ?? null;
  const currentTxt = useMemo(() => current
    ? appendPreferredJsonFileDelivery(buildSpecialV3Txt(current), resultFilename(current))
    : "", [current]);

  useEffect(() => setActiveIndex(0), [batchSize, cards]);

  const handleDownloadTxt = () => {
    if (!current) return;
    const saved = persistV3(current);
    downloadText(
      specialV3TxtFilename(current),
      currentTxt,
      "text/plain;charset=utf-8",
    );
    toast[saved ? "success" : "warning"](
      saved
        ? `TXT do lote ${current.batch_index} baixado e registrado.`
        : "TXT baixado, mas o manifesto local não pôde ser registrado. Exporte novamente antes de importar.",
    );
  };

  const handleCopyTxt = async () => {
    if (!current) return;
    const saved = persistV3(current);
    const copied = await copyText(currentTxt);
    if (!copied) {
      toast.error("Não foi possível copiar o TXT.");
      return;
    }
    toast[saved ? "success" : "warning"](
      saved
        ? "TXT completo copiado. Envie todo o conteúdo para a IA."
        : "TXT copiado, mas o manifesto local falhou. Baixe novamente antes da importação.",
    );
  };

  const handleLegacyCsv = () => {
    if (!legacyCurrent) return;
    persistLegacy(legacyCurrent);
    downloadText(
      specialCsvFilename(legacyCurrent),
      `\uFEFF${buildSpecialCsvExport(legacyCurrent)}`,
      "text/csv;charset=utf-8",
    );
    toast.success("CSV antigo baixado em modo de compatibilidade.");
  };

  const handleLegacyJson = () => {
    if (!legacyCurrent) return;
    persistLegacy(legacyCurrent);
    downloadText(
      `ape-especiais-legado-${legacyCurrent.export_id}.json`,
      JSON.stringify(legacyCurrent, null, 2),
      "application/json;charset=utf-8",
    );
    toast.success("JSON antigo baixado em modo de compatibilidade.");
  };

  const handleLegacyPrompt = async () => {
    if (!legacyCurrent) return;
    persistLegacy(legacyCurrent);
    const copied = await copyText(buildSpecialPrompt(legacyCurrent));
    toast[copied ? "success" : "error"](
      copied ? "Prompt antigo copiado." : "Não foi possível copiar o prompt antigo.",
    );
  };

  const handleLegacyCsvPrompt = async () => {
    if (!legacyCurrent) return;
    persistLegacy(legacyCurrent);
    const copied = await copyText(buildSpecialCsvPrompt(legacyCurrent));
    toast[copied ? "success" : "error"](
      copied ? "Prompt CSV antigo copiado." : "Não foi possível copiar.",
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-1rem)] max-w-4xl grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-h-[92vh] sm:gap-4 sm:p-6">
        <DialogHeader className="border-b px-5 pb-4 pt-5 text-left sm:border-0 sm:p-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-sky-500" />
            Preparar Cards Especiais para a IA
          </DialogTitle>
          <DialogDescription>
            O App Piteco envia um TXT completo. A IA deve devolver preferencialmente um arquivo JSON oficial v3.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 border-b px-5 py-3 text-xs sm:grid-cols-4 sm:rounded-xl sm:border sm:bg-muted/30 sm:p-2">
          {[
            [FileText, "1. Baixar TXT"],
            [Sparkles, "2. Enviar à IA"],
            [FileJson, "3. Receber .json"],
            [Upload, "4. Importar"],
          ].map(([Icon, label]) => (
            <div key={String(label)} className="flex items-center justify-center gap-1.5 rounded-lg bg-background px-2 py-2 font-medium shadow-sm">
              <Icon className="h-4 w-4 text-primary" />
              {label as string}
            </div>
          ))}
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-0 sm:py-0 sm:pb-0">
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <div className="font-semibold">Um arquivo de ida, um arquivo de volta</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  O TXT já contém o prompt, o contrato e os cards. A IA deve devolver de preferência um arquivo .json pronto para importar; JSON puro no chat é apenas o fallback.
                </p>
              </div>
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

          {current && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} disabled={activeIndex === 0}>
                  <ChevronLeft className="h-4 w-4" />Anterior
                </Button>
                <div className="min-w-0 text-center">
                  <div className="font-medium">Lote {current.batch_index} de {current.batch_count}</div>
                  <div className="truncate text-xs text-muted-foreground">{current.item_count} card(s) · {current.batch_id}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setActiveIndex((index) => Math.min(batches.length - 1, index + 1))} disabled={activeIndex >= batches.length - 1}>
                  Próximo<ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button size="lg" onClick={handleDownloadTxt} className="h-auto min-h-16 justify-start px-4 py-3 text-left">
                  <Download className="mr-3 h-6 w-6" />
                  <span>
                    <span className="block font-semibold">Baixar TXT completo</span>
                    <span className="block text-xs font-normal opacity-80">Prompt, contrato e dados no mesmo arquivo</span>
                  </span>
                </Button>
                <Button size="lg" variant="secondary" onClick={handleCopyTxt} className="h-auto min-h-16 justify-start px-4 py-3 text-left">
                  <Copy className="mr-3 h-6 w-6" />
                  <span>
                    <span className="block font-semibold">Copiar TXT completo</span>
                    <span className="block text-xs font-normal opacity-80">Cole todo o conteúdo na conversa com a IA</span>
                  </span>
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">Prévia do arquivo oficial</div>
                    <div className="text-xs text-muted-foreground">O nome preferido do retorno é {resultFilename(current)}.</div>
                  </div>
                  <Badge variant="outline">TXT → arquivo JSON v3</Badge>
                </div>
                <Textarea readOnly value={currentTxt} className="min-h-[230px] resize-y font-mono text-[11px]" />
              </div>

              <details className="rounded-lg border bg-muted/20 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground">Compatibilidade com arquivos antigos</summary>
                <p className="mt-2 text-xs text-muted-foreground">
                  Use somente para concluir lotes antigos. Novas exportações devem usar o TXT oficial.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleLegacyCsv}><FileSpreadsheet className="mr-1 h-4 w-4" />Baixar CSV antigo</Button>
                  <Button variant="outline" size="sm" onClick={handleLegacyCsvPrompt}><Copy className="mr-1 h-4 w-4" />Prompt CSV antigo</Button>
                  <Button variant="outline" size="sm" onClick={handleLegacyJson}><FileJson className="mr-1 h-4 w-4" />Baixar JSON antigo</Button>
                  <Button variant="outline" size="sm" onClick={handleLegacyPrompt}><Copy className="mr-1 h-4 w-4" />Prompt JSON antigo</Button>
                </div>
              </details>
            </div>
          )}
        </div>

        <DialogFooter className="border-t bg-background px-5 py-3 sm:border-0 sm:p-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
