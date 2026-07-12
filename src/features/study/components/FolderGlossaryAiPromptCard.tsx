import { useMemo, useState } from "react";
import { ClipboardCopy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useFolderGlossarySummary } from "@/hooks/useFolderGlossary";
import { buildFolderGlossaryAiPrompt } from "@/features/study/lib/folderGlossaryPrompt";

interface Props {
  folderId: string;
  folderTitle: string;
  labelA: string;
  labelB: string;
}

export function FolderGlossaryAiPromptCard({
  folderId,
  folderTitle,
  labelA,
  labelB,
}: Props) {
  const [open, setOpen] = useState(false);
  const { canEdit, isLoading } = useFolderGlossarySummary(folderId);
  const prompt = useMemo(
    () => buildFolderGlossaryAiPrompt({ folderTitle, labelA, labelB }),
    [folderTitle, labelA, labelB],
  );

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt oficial do glossário copiado.");
    } catch {
      toast.error("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
    }
  };

  if (isLoading || !canEdit) return null;

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-medium">Gerar glossário com IA</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Copie o prompt oficial. Ele explica o formato JSON aceito, os lados desta pasta e as regras para evitar duplicações.
            </p>
          </div>
        </div>
        <Button className="shrink-0" onClick={() => setOpen(true)}>
          <Sparkles className="mr-2 h-4 w-4" />
          Abrir prompt da IA
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Prompt oficial do glossário da pasta</DialogTitle>
            <DialogDescription>
              Cole este texto em uma IA, complete o tema ou material e importe a resposta JSON nesta pasta.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
              Formato esperado: <strong>app-piteco-folder-glossary 1.0</strong>. A resposta deve ser JSON puro, sem bloco de código e sem texto adicional.
            </div>
            <Textarea
              value={prompt}
              readOnly
              className="min-h-[430px] resize-none font-mono text-xs leading-relaxed"
              aria-label="Prompt oficial para gerar o glossário com IA"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => void copyPrompt()}>
              <ClipboardCopy className="mr-2 h-4 w-4" />
              Copiar prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
