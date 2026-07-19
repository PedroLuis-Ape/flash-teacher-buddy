import { useEffect, useState } from "react";
import { Gem, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SpecialFlashcardDetail, SpecialFocusTag } from "@/hooks/useSpecialFlashcards";
import { useUpdateSpecialFocus } from "@/hooks/useUpdateSpecialFocus";

const TAGS: Array<{ value: SpecialFocusTag; label: string }> = [
  { value: "grammar", label: "Gramática" },
  { value: "vocabulary", label: "Vocabulário" },
  { value: "expression", label: "Expressão" },
  { value: "phrasal_verb", label: "Phrasal verb" },
  { value: "pronunciation", label: "Pronúncia" },
  { value: "translation", label: "Tradução" },
  { value: "natural_usage", label: "Uso natural" },
  { value: "other", label: "Outro" },
];

interface Props {
  card: SpecialFlashcardDetail | null;
  userId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SpecialFocusEditorDialog({ card, userId, open, onOpenChange }: Props) {
  const mutation = useUpdateSpecialFocus(userId);
  const [focusText, setFocusText] = useState("");
  const [focusTag, setFocusTag] = useState<SpecialFocusTag | null>(null);
  const [focusNote, setFocusNote] = useState("");

  useEffect(() => {
    if (!open || !card) return;
    setFocusText(card.focus_text ?? "");
    setFocusTag(card.focus_tag ?? null);
    setFocusNote(card.focus_note ?? card.notes ?? "");
  }, [card, open]);

  const clear = () => {
    setFocusText("");
    setFocusTag(null);
    setFocusNote("");
  };

  const save = async () => {
    if (!card) return;
    try {
      await mutation.mutateAsync({
        specialId: card.id,
        flashcardId: card.flashcard_id,
        focus: {
          focus_text: focusText,
          focus_side: null,
          focus_tag: focusTag,
          focus_note: focusNote,
        },
      });
      onOpenChange(false);
    } catch {
      // O hook já apresenta o erro e restaura o cache otimista.
    }
  };

  return <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
    <DialogContent className="bottom-0 top-auto grid max-h-[calc(100dvh-1rem)] max-w-none translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-t-2xl p-0 sm:bottom-auto sm:top-[50%] sm:max-w-lg sm:translate-y-[-50%] sm:rounded-lg">
      <DialogHeader className="border-b px-5 pb-4 pt-5 text-left">
        <DialogTitle className="flex items-center gap-2">
          <Gem className="h-5 w-5 text-primary" />
          Editar foco pedagógico
        </DialogTitle>
        <DialogDescription>
          Defina exatamente o que a IA deve explicar neste card.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
        {card && <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="font-semibold">{card.term}</div>
          <div className="mt-1 text-muted-foreground">{card.translation}</div>
        </div>}

        <div className="space-y-1.5">
          <label htmlFor="special-focus-text" className="text-sm font-medium">Trecho específico</label>
          <Input
            id="special-focus-text"
            value={focusText}
            onChange={(event) => setFocusText(event.target.value)}
            placeholder="Ex.: would rather, get used to..."
            maxLength={240}
          />
          <p className="text-xs text-muted-foreground">Deixe vazio quando a IA puder analisar o card inteiro.</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Tipo de dúvida</div>
            {focusTag && <Button type="button" variant="ghost" size="sm" onClick={() => setFocusTag(null)}>Limpar tipo</Button>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TAGS.map((tag) => <Button
              key={tag.value}
              type="button"
              variant={focusTag === tag.value ? "default" : "outline"}
              size="sm"
              className="min-w-0 px-2 text-xs"
              onClick={() => setFocusTag(tag.value)}
            >
              <span className="truncate">{tag.label}</span>
            </Button>)}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="special-focus-note" className="text-sm font-medium">Orientação para a IA</label>
          <Textarea
            id="special-focus-note"
            value={focusNote}
            onChange={(event) => setFocusNote(event.target.value)}
            placeholder="Ex.: explique por que não usamos o infinitivo sem to neste caso."
            className="min-h-24 resize-y"
            maxLength={1_500}
          />
        </div>
      </div>

      <DialogFooter className="gap-2 border-t bg-background px-5 py-3">
        <Button type="button" variant="outline" onClick={clear} disabled={mutation.isPending}>
          <RotateCcw className="mr-1 h-4 w-4" />Limpar foco
        </Button>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
        <Button type="button" onClick={() => void save()} disabled={mutation.isPending || !card}>
          {mutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Salvar foco
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
