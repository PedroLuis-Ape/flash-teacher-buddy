import { ClipboardCopy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildSmartImportPrompt, type SmartImportPromptOptions } from "./prompt";

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SmartImportPromptOptions;
  onConfigure: () => void;
}

export function SmartImportSourceStep({ value, onChange, options, onConfigure }: Props) {
  const copyPrompt = async () => {
    await navigator.clipboard.writeText(buildSmartImportPrompt(options));
    toast.success("Prompt inteligente copiado.");
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Gerar com IA</h3>
            <p className="text-sm text-muted-foreground">O prompt inclui somente os recursos ativados.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onConfigure}>
              <Sparkles className="mr-2 h-4 w-4" />Configurar
            </Button>
            <Button size="sm" onClick={copyPrompt}>
              <ClipboardCopy className="mr-2 h-4 w-4" />Copiar prompt
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge>Cards normais</Badge>
          {options.includeGlobalGlossary && <Badge variant="secondary">Glossário global</Badge>}
          {options.includeContextGlossary && <Badge variant="secondary">Glossário contextual</Badge>}
          {options.includeDetailedExplanations && <Badge variant="secondary">Explicações</Badge>}
          {options.includeLayeredCards && <Badge variant="secondary">Agrupados</Badge>}
          <Badge variant="outline">{options.outputFormat?.toUpperCase()}</Badge>
        </div>
      </section>
      <section className="space-y-2">
        <Label className="text-base">Cole o conteúdo ou o texto de um arquivo</Label>
        <p className="text-sm text-muted-foreground">Detecção automática de JSON 2.0, CSV inteligente, CSV simples e texto estruturado.</p>
        <Textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-[380px] resize-y font-mono text-xs sm:text-sm" placeholder="Cole aqui a resposta da IA, CSV ou texto estruturado..." />
      </section>
    </div>
  );
}
