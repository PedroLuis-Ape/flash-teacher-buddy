import { useState } from "react";
import { Clipboard, Eye, FileText, Layers3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "../copyText";

type PromptMode = "standard" | "layered";

interface PrimaryPromptCardProps {
  prompt: string;
  layeredPrompt?: string;
}

export function PrimaryPromptCard({ prompt, layeredPrompt }: PrimaryPromptCardProps) {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<PromptMode>("standard");
  const hasLayeredPrompt = Boolean(layeredPrompt);
  const activePrompt = mode === "layered" && layeredPrompt ? layeredPrompt : prompt;
  const activeLabel = mode === "layered" ? "com camadas" : "padrão";

  const copyPrompt = () => {
    if (copyText(activePrompt)) toast.success(`Prompt ${activeLabel} copiado.`);
    else toast.error("Não foi possível copiar o prompt.");
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="font-semibold">1. Criar conteúdo com IA</h2>
        <p className="text-sm text-muted-foreground">
          Escolha o tipo de pacote, copie o prompt e descreva naturalmente o conteúdo desejado.
        </p>
      </div>

      {hasLayeredPrompt && (
        <div className="rounded-xl border bg-muted/30 p-1" role="group" aria-label="Tipo de prompt">
          <div className="grid grid-cols-2 gap-1">
            <Button
              type="button"
              size="sm"
              variant={mode === "standard" ? "default" : "ghost"}
              className="h-auto min-h-11 whitespace-normal px-3 py-2"
              aria-pressed={mode === "standard"}
              onClick={() => setMode("standard")}
            >
              <FileText className="mr-2 h-4 w-4 shrink-0" />
              Cards normais
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "layered" ? "default" : "ghost"}
              className="h-auto min-h-11 whitespace-normal px-3 py-2"
              aria-pressed={mode === "layered"}
              onClick={() => setMode("layered")}
            >
              <Layers3 className="mr-2 h-4 w-4 shrink-0" />
              Com camadas
            </Button>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {mode === "layered"
          ? "Use para termos, expressões ou conceitos que precisam reunir dois ou mais sentidos relacionados no mesmo grupo."
          : "Use para pacotes tradicionais com um conteúdo independente em cada flashcard."}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={copyPrompt}>
          <Clipboard className="mr-2 h-4 w-4" />
          {mode === "layered" ? "Copiar prompt com camadas" : "Copiar prompt padrão"}
        </Button>
        <Button variant="outline" onClick={() => setVisible((value) => !value)}>
          <Eye className="mr-2 h-4 w-4" />
          {visible ? "Ocultar" : "Visualizar"}
        </Button>
      </div>

      {visible && (
        <Textarea
          value={activePrompt}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-72 font-mono text-xs"
        />
      )}
    </Card>
  );
}
