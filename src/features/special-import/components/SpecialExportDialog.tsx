import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Download, FileJson } from "lucide-react";
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

  const handleCopy = async () => {
    if (!current) return;
    persist(current);
    const copied = await copyText(buildSpecialPrompt(current));
    toast[copied ? "success" : "error"](
      copied
        ? `Prompt do lote ${current.batch_index} copiado. O manifesto foi salvo para conferir a importação.`
        : "Não foi possível copiar o prompt.",
    );
  };

  const handleDownloadPrompt = () => {
    if (!current) return;
    persist(current);
    downloadText(
      `ape-especiais-${current.export_id}.txt`,
      buildSpecialPrompt(current),
      "text/plain;charset=utf-8",
    );
    toast.success(`Prompt do lote ${current.batch_index} baixado.`);
  };

  const handleDownloadJson = () => {
    if (!current) return;
    persist(current);
    downloadText(
      `ape-especiais-${current.export_id}.json`,
      JSON.stringify(current, null, 2),
      "application/json;charset=utf-8",
    );
    toast.success(`Dados do lote ${current.batch_index} baixados.`);
  };

  const handleDownloadAll = () => {
    if (batches.length === 0) return;
    batches.forEach(persist);
    const content = batches.map((batch) => (
      `===== LOTE ${batch.batch_index} DE ${batch.batch_count} | ${batch.export_id} =====\n\n${buildSpecialPrompt(batch)}`
    )).join("\n\n\n");
    downloadText(
      `ape-especiais-${batches.length}-lotes.txt`,
      content,
      "text/plain;charset=utf-8",
    );
    toast.success(`${batches.length} lote(s) baixados e registrados.`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Exportar cards especiais para IA</DialogTitle>
          <DialogDescription>
            Use um lote por conversa com a IA. O app registra cada lote para detectar cards ausentes, duplicados e IDs alterados na volta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="text-sm font-medium">Cards por lote</div>
          <Select value={String(batchSize)} onValueChange={(value) => setBatchSize(Number(value))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 50].map((size) => (
                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary">{cards.length} card(s)</Badge>
          <Badge variant="outline">{batches.length} lote(s)</Badge>
        </div>

        {current && (
          <div className="flex-1 min-h-0 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
                disabled={activeIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <div className="text-center">
                <div className="font-medium">Lote {current.batch_index} de {current.batch_count}</div>
                <div className="text-xs text-muted-foreground">{current.card_count} card(s) · {current.export_id}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveIndex((index) => Math.min(batches.length - 1, index + 1))}
                disabled={activeIndex >= batches.length - 1}
              >
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Textarea
              readOnly
              value={buildSpecialPrompt(current)}
              className="min-h-[300px] max-h-[45vh] font-mono text-[11px]"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-1.5" />
                Copiar este lote
              </Button>
              <Button variant="outline" onClick={handleDownloadPrompt}>
                <Download className="h-4 w-4 mr-1.5" />
                Baixar prompt
              </Button>
              <Button variant="outline" onClick={handleDownloadJson}>
                <FileJson className="h-4 w-4 mr-1.5" />
                Baixar dados JSON
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {batches.length > 1 && (
            <Button variant="outline" onClick={handleDownloadAll}>
              <Download className="h-4 w-4 mr-1.5" />
              Baixar todos os lotes
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
