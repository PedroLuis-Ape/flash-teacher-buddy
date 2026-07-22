import { useMemo, useState } from "react";
import { ClipboardCopy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { buildFolderGlossaryAiPrompt } from "@/features/study/lib/folderGlossaryPrompt";

interface Props {
  turmaTitle: string;
  labelA: string;
  labelB: string;
}

export function ClassGlossaryAiPromptCard({ turmaTitle, labelA, labelB }: Props) {
  const [open, setOpen] = useState(false);
  const prompt = useMemo(() => buildFolderGlossaryAiPrompt({
    folderTitle: `Turma: ${turmaTitle}`,
    labelA,
    labelB,
  }), [labelA, labelB, turmaTitle]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt oficial do glossário da turma copiado.");
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-medium">Gerar glossário da turma com IA</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Use o mesmo contrato validado das pastas; o resultado será armazenado somente nesta turma.
            </p>
          </div>
        </div>
        <Button className="shrink-0" onClick={() => setOpen(true)}>
          <Sparkles className="mr-2 h-4 w-4" />Abrir prompt da IA
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Prompt oficial do glossário da turma</DialogTitle>
            <DialogDescription>
              Copie o texto, processe-o na IA escolhida e use o JSON resultante nesta caixa.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <Textarea value={prompt} readOnly className="min-h-[430px] resize-none font-mono text-xs leading-relaxed" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            <Button onClick={() => void copyPrompt()}>
              <ClipboardCopy className="mr-2 h-4 w-4" />Copiar prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
