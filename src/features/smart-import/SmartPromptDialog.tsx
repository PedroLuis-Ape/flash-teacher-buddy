import { ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { buildSmartImportPrompt, type SmartImportPromptOptions } from "./prompt";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: SmartImportPromptOptions;
  onChange: (value: SmartImportPromptOptions) => void;
}

export function SmartPromptDialog({ open, onOpenChange, value, onChange }: Props) {
  const prompt = buildSmartImportPrompt(value);
  const set = <K extends keyof SmartImportPromptOptions>(key: K, next: SmartImportPromptOptions[K]) => onChange({ ...value, [key]: next });
  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    toast.success("Prompt inteligente copiado.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90vh,820px)] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Configurar prompt inteligente</DialogTitle>
          <DialogDescription>Somente os recursos ativados serão solicitados à IA.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <PromptSwitch label="Glossário global" checked={value.includeGlobalGlossary} onChange={(next) => set("includeGlobalGlossary", next)} />
            <PromptSwitch label="Glossário contextual por card" checked={value.includeContextGlossary} onChange={(next) => set("includeContextGlossary", next)} />
            <PromptSwitch label="Explicações detalhadas" checked={value.includeDetailedExplanations} onChange={(next) => set("includeDetailedExplanations", next)} />
            <PromptSwitch label="Notas de uso" checked={value.includeUsageNotes} onChange={(next) => set("includeUsageNotes", next)} />
            <PromptSwitch label="Erros comuns" checked={value.includeCommonMistakes} onChange={(next) => set("includeCommonMistakes", next)} />
            <PromptSwitch label="Cards agrupados" checked={value.includeLayeredCards} onChange={(next) => set("includeLayeredCards", next)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tema</Label>
              <Input value={value.theme || ""} onChange={(event) => set("theme", event.target.value)} placeholder="Ex.: inglês para reuniões" />
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={value.cardCount || ""} onChange={(event) => set("cardCount", Number(event.target.value) || undefined)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Formato de saída</Label>
            <Select value={value.outputFormat} onValueChange={(next) => set("outputFormat", next as SmartImportPromptOptions["outputFormat"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON 2.0 — recomendado</SelectItem>
                <SelectItem value="csv">CSV inteligente</SelectItem>
                <SelectItem value="text">Texto simples</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea value={prompt} readOnly className="min-h-[320px] font-mono text-xs" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={copy}><ClipboardCopy className="mr-2 h-4 w-4" />Copiar prompt</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PromptSwitch({ label, checked, onChange }: { label: string; checked?: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <Label className="cursor-pointer">{label}</Label>
      <Switch checked={Boolean(checked)} onCheckedChange={onChange} />
    </div>
  );
}
