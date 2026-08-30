import { useEffect, useMemo, useState } from "react";
import { Flag, Loader2 } from "lucide-react";
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
import type { SpecialFocusContext } from "@/hooks/useSpecialFlashcards";
import {
  ATTENTION_POINT_TAGS,
  suggestAttentionToken,
  tokenizeAttentionText,
  type AttentionPointTag,
} from "@/features/study/lib/attentionPoint";

interface AttentionPointSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectedText: string;
  typedText?: string | null;
  focusSide: "a" | "b";
  isSaving?: boolean;
  onSave: (focus: SpecialFocusContext) => Promise<void> | void;
}

export function AttentionPointSheet({
  open,
  onOpenChange,
  expectedText,
  typedText,
  focusSide,
  isSaving = false,
  onSave,
}: AttentionPointSheetProps) {
  const tokens = useMemo(() => tokenizeAttentionText(expectedText), [expectedText]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedTag, setSelectedTag] = useState<AttentionPointTag | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedIndex(
      typedText?.trim() ? suggestAttentionToken(expectedText, typedText) : null,
    );
    setSelectedTag(null);
    setNote("");
  }, [expectedText, open, typedText]);

  const selectedToken = selectedIndex == null ? null : tokens[selectedIndex];

  const handleSave = async () => {
    await onSave({
      focus_text: selectedToken?.value ?? null,
      focus_side: focusSide,
      focus_tag: selectedTag
        ? ATTENTION_POINT_TAGS.find((tag) => tag.value === selectedTag)?.specialTag ?? "other"
        : null,
      focus_note: note.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSaving) onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        hideClose
        className="bottom-0 top-auto grid max-h-[min(86dvh,38rem)] max-w-none translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-t-2xl p-0 sm:bottom-auto sm:top-[50%] sm:max-w-lg sm:translate-y-[-50%] sm:rounded-lg"
      >
        <DialogHeader className="border-b px-4 pb-3 pt-4 text-left sm:px-5">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Flag className="h-4 w-4 text-primary" />
            Guardar ponto de atenção
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Escolha a palavra ou expressão que merece uma revisão depois.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Frase correta
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Palavras da frase correta">
              {tokens.map((token) => {
                const active = selectedIndex === token.index;
                return (
                  <button
                    key={`${token.index}-${token.raw}`}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedIndex(active ? null : token.index)}
                    className={
                      "rounded-full border px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
                      (active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary/60 hover:bg-primary/5")
                    }
                  >
                    {token.raw}
                  </button>
                );
              })}
            </div>
            {typedText && (
              <p className="mt-3 text-xs text-muted-foreground">
                Você escreveu: <span className="font-medium text-foreground">{typedText}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Motivo (opcional)</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {ATTENTION_POINT_TAGS.map((tag) => (
                <Button
                  key={tag.value}
                  type="button"
                  variant={selectedTag === tag.value ? "default" : "outline"}
                  size="sm"
                  className="h-9 min-w-0 px-2 text-xs"
                  aria-pressed={selectedTag === tag.value}
                  onClick={() => setSelectedTag((current) => (current === tag.value ? null : tag.value))}
                >
                  <span className="truncate">{tag.label}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="attention-point-note" className="text-xs font-semibold text-muted-foreground">
              O que está pegando? <span className="font-normal">(opcional)</span>
            </label>
            <Textarea
              id="attention-point-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex.: Sempre esqueço o segundo r."
              maxLength={1_500}
              className="min-h-[76px] resize-y text-sm"
            />
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 border-t bg-background px-4 py-3 sm:px-5">
          <Button
            type="button"
            variant="ghost"
            className="flex-1 sm:flex-none"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1 sm:flex-none"
            onClick={() => void handleSave()}
            disabled={isSaving || tokens.length === 0}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

