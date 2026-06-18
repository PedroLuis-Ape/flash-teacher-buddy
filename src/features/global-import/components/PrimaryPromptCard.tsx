import { useState } from "react";
import { Clipboard, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "../copyText";

export function PrimaryPromptCard({ prompt }: { prompt: string }) {
  const [visible, setVisible] = useState(false);
  const copyPrompt = () => {
    if (copyText(prompt)) toast.success("Prompt padrão copiado.");
    else toast.error("Não foi possível copiar o prompt.");
  };

  return (
    <Card className="space-y-3 p-5">
      <h2 className="font-semibold">1. Criar conteúdo com IA</h2>
      <p className="text-sm text-muted-foreground">
        Copie o prompt, cole em uma IA e descreva naturalmente o conteúdo desejado.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={copyPrompt}><Clipboard className="mr-2 h-4 w-4" />Copiar prompt padrão</Button>
        <Button variant="outline" onClick={() => setVisible((value) => !value)}>
          <Eye className="mr-2 h-4 w-4" />{visible ? "Ocultar" : "Visualizar"}
        </Button>
      </div>
      {visible && <Textarea value={prompt} readOnly onFocus={(event) => event.currentTarget.select()} className="min-h-72 font-mono text-xs" />}
    </Card>
  );
}
