import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function PrimaryPromptCard({ prompt }: { prompt: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <Card className="space-y-3 p-5">
      <h2 className="font-semibold">1. Criar conteúdo com IA</h2>
      <p className="text-sm text-muted-foreground">
        Abra o prompt padrão, copie, cole em uma IA e descreva naturalmente o conteúdo desejado.
      </p>
      <Button className="w-full" onClick={() => setVisible((value) => !value)}>
        {visible ? "Ocultar prompt padrão" : "Abrir prompt padrão para copiar"}
      </Button>
      {visible && (
        <Textarea
          value={prompt}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-72 font-mono text-xs"
        />
      )}
    </Card>
  );
}
