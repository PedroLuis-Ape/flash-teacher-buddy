import { useMemo, useState } from "react";
import { Clipboard, Eye, GraduationCap, Layers3, LibraryBig } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "../copyText";
import { buildFinalGlobalImportPrompt } from "../prompts/finalPrompt";
import type { GlobalImportPromptDestinationContext } from "../prompts/presets";
import { AiPromptPresetSelector } from "./AiPromptPresetSelector";

interface Props {
  context: GlobalImportPromptDestinationContext;
}

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function ClassroomCompletePromptCard({ context }: Props) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const ownerEmail = normalized(import.meta.env.VITE_OWNER_EMAIL);
  const ownerCanary = Boolean(ownerEmail && normalized(user?.email) === ownerEmail);
  const prompt = useMemo(
    () => buildFinalGlobalImportPrompt("complete", context),
    [context],
  );

  if (ownerCanary) {
    return <AiPromptPresetSelector context={context} smartInterview />;
  }

  const copyPrompt = () => {
    if (copyText(prompt)) toast.success("Prompt completo para turma copiado.");
    else toast.error("Não foi possível copiar o prompt.");
  };

  return (
    <Card className="space-y-5 border-primary/30 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Pacote pedagógico completo para a turma</h2>
            <Badge>padrão da turma</Badge>
            <Badge variant="secondary">contrato 2.0</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            O prompt da turma já vem configurado para gerar conteúdo completo para alunos, sem precisar escolher um modo.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <LibraryBig className="mb-2 h-4 w-4 text-primary" />
          <strong>Conteúdo enriquecido</strong>
          <p className="mt-1 text-muted-foreground">Explicações, exemplos, notas de uso, erros comuns, word hints e glossário.</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <Layers3 className="mb-2 h-4 w-4 text-primary" />
          <strong>Camadas preservadas</strong>
          <p className="mt-1 text-muted-foreground">Usos e significados relacionados podem ser agrupados em cards em camadas.</p>
        </div>
      </div>

      <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
        Os cards, explicações e camadas serão importados na turma atual. As entradas de glossário irão para a Caixa de Glossário central da conta do professor, sem criar cópias por turma.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={copyPrompt}><Clipboard className="mr-2 h-4 w-4" />Copiar prompt completo</Button>
        <Button variant="outline" onClick={() => setVisible((value) => !value)}>
          <Eye className="mr-2 h-4 w-4" />{visible ? "Ocultar prompt" : "Visualizar prompt"}
        </Button>
      </div>

      {visible && (
        <Textarea
          value={prompt}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-80 font-mono text-xs"
        />
      )}
    </Card>
  );
}
