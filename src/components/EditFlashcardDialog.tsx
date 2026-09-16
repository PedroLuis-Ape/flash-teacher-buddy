import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supportsImages } from "@/features/study/lib/studyTypeConfig";
import { WordHintEditor } from "@/features/study/components/WordHintEditor";
import { parseWordHints, type WordHint } from "@/features/study/lib/wordHints";
import { setCurrentDetailedExplanation } from "@/features/study/lib/currentDetailedExplanation";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { LayeredCardEditor } from "@/features/cards/components/LayeredCardEditor";
import { supabase } from "@/integrations/supabase/client";

export const IN_GAME_CARD_NOTES_UPDATED_EVENT = "ape:flashcard:notes-updated";

const RICH_NOTE_KEYS = [
  "note_text",
  "short_explanation",
  "detailed_explanation",
  "usage_notes",
  "common_mistakes",
] as const;

interface EditFlashcardDialogProps {
  flashcard: {
    id: string;
    term: string;
    translation: string;
    hint?: string | null;
    image_url_a?: string | null;
    image_url_b?: string | null;
    word_hints?: unknown;
    list_id?: string;
    user_id?: string;
    parent_card_id?: string | null;
    note_text?: string[] | null;
    short_explanation?: string | null;
    detailed_explanation?: string | null;
    usage_notes?: string | null;
    common_mistakes?: string | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (id: string, term: string, translation: string, hint: string, imageUrlA?: string, imageUrlB?: string, wordHints?: WordHint[]) => Promise<void>;
  studyType?: string;
  labelA?: string;
  labelB?: string;
  /**
   * `notes-only` is used by the in-game fallback editor (notably Mixed Study):
   * it edits pedagogical notes without changing the prompt/answer while the
   * activity is running.
   */
  contentMode?: "full" | "notes-only";
}

function normalizeNotes(notes: string[] | null | undefined): string[] {
  return (notes || []).map((note) => note.trim()).filter(Boolean);
}

function normalizeOptionalText(value: string | null | undefined): string {
  return (value || "").trim();
}

export const EditFlashcardDialog = ({
  flashcard,
  isOpen,
  onClose,
  onSave,
  studyType = "language",
  labelA,
  labelB,
  contentMode = "full",
}: EditFlashcardDialogProps) => {
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [hint, setHint] = useState("");
  const [imageUrlA, setImageUrlA] = useState("");
  const [imageUrlB, setImageUrlB] = useState("");
  const [wordHints, setWordHints] = useState<WordHint[]>([]);
  const [noteText, setNoteText] = useState("");
  const [shortExplanation, setShortExplanation] = useState("");
  const [detailedExplanation, setDetailedExplanation] = useState("");
  const [usageNotes, setUsageNotes] = useState("");
  const [commonMistakes, setCommonMistakes] = useState("");
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<{ listId: string } | null>(null);

  const notesOnly = contentMode === "notes-only";
  // Several legacy callers intentionally fetch only the basic card columns.
  // Never render/save empty rich fields for those callers: otherwise opening
  // an old editor and pressing Save could erase explanations that were never
  // loaded into this dialog in the first place.
  const hasLoadedRichNotes = Boolean(
    flashcard && RICH_NOTE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(flashcard, key)),
  );
  const showRichNotes = notesOnly || hasLoadedRichNotes;
  const showImages = !notesOnly && supportsImages(studyType);
  const showWordHints = !notesOnly && studyType === "language";
  const showLayers =
    !notesOnly &&
    FEATURE_FLAGS.layered_cards &&
    !!flashcard &&
    !flashcard.parent_card_id;

  useEffect(() => {
    if (flashcard) {
      setTerm(flashcard.term);
      setTranslation(flashcard.translation);
      setHint(flashcard.hint || "");
      setImageUrlA(flashcard.image_url_a || "");
      setImageUrlB(flashcard.image_url_b || "");
      setWordHints(parseWordHints(flashcard.word_hints));
      setNoteText(normalizeNotes(flashcard.note_text).join("\n"));
      setShortExplanation(flashcard.short_explanation || "");
      setDetailedExplanation(flashcard.detailed_explanation || "");
      setUsageNotes(flashcard.usage_notes || "");
      setCommonMistakes(flashcard.common_mistakes || "");
    }
  }, [flashcard]);

  useEffect(() => {
    if (!FEATURE_FLAGS.layered_cards || !flashcard || !isOpen || notesOnly) return;
    if (flashcard.list_id) {
      setMeta({ listId: flashcard.list_id });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("flashcards")
        .select("list_id")
        .eq("id", flashcard.id)
        .maybeSingle();
      if (!cancelled && data) {
        setMeta({ listId: (data as any).list_id });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flashcard, isOpen, notesOnly]);

  const handleSave = async () => {
    if (!flashcard) return;
    if (!notesOnly && (!term.trim() || !translation.trim())) return;

    const validHints = wordHints.filter((wordHint) => wordHint.text.trim() && wordHint.translation.trim());
    const normalizedNotes = normalizeNotes(noteText.split(/\r?\n/));
    const extendedPayload = {
      note_text: normalizedNotes.length > 0 ? normalizedNotes : null,
      short_explanation: shortExplanation.trim() || null,
      detailed_explanation: detailedExplanation.trim() || null,
      usage_notes: usageNotes.trim() || null,
      common_mistakes: commonMistakes.trim() || null,
    };
    const richNotesDirty = showRichNotes && (
      JSON.stringify(normalizedNotes) !== JSON.stringify(normalizeNotes(flashcard.note_text))
      || normalizeOptionalText(extendedPayload.short_explanation) !== normalizeOptionalText(flashcard.short_explanation)
      || normalizeOptionalText(extendedPayload.detailed_explanation) !== normalizeOptionalText(flashcard.detailed_explanation)
      || normalizeOptionalText(extendedPayload.usage_notes) !== normalizeOptionalText(flashcard.usage_notes)
      || normalizeOptionalText(extendedPayload.common_mistakes) !== normalizeOptionalText(flashcard.common_mistakes)
    );
    const shouldPersistRichNotes = showRichNotes && richNotesDirty;

    setSaving(true);
    try {
      if (!notesOnly) {
        await onSave?.(
          flashcard.id,
          term.trim(),
          translation.trim(),
          hint.trim(),
          imageUrlA.trim() || undefined,
          imageUrlB.trim() || undefined,
          validHints.length > 0 ? validHints : undefined,
        );
      }

      if (shouldPersistRichNotes) {
        // Rich note fields belong to the flashcard itself. Persist them only
        // when this caller actually loaded those columns (or explicitly opened
        // notes-only mode) and the user changed them. This avoids erasing
        // pre-existing explanations from older/basic editor call sites.
        const { data: confirmed, error: notesError } = await supabase
          .from("flashcards")
          .update(extendedPayload)
          .eq("id", flashcard.id)
          .select("id")
          .maybeSingle();

        if (notesError || !confirmed) {
          console.error("[EditFlashcardDialog] Falha ao salvar notas do card:", notesError);
          toast.error("Não foi possível salvar as notas deste card.");
          return;
        }

        // Keep the exact object used by an active Study session fresh. These
        // note-only changes must not rebuild the deck or move currentIndex.
        flashcard.note_text = extendedPayload.note_text;
        flashcard.short_explanation = extendedPayload.short_explanation;
        flashcard.detailed_explanation = extendedPayload.detailed_explanation;
        flashcard.usage_notes = extendedPayload.usage_notes;
        flashcard.common_mistakes = extendedPayload.common_mistakes;

        setCurrentDetailedExplanation({
          explanation: extendedPayload.detailed_explanation,
          usageNotes: extendedPayload.usage_notes,
          commonMistakes: extendedPayload.common_mistakes,
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(IN_GAME_CARD_NOTES_UPDATED_EVENT, {
            detail: {
              flashcardId: flashcard.id,
              ...extendedPayload,
            },
          }));
        }

        if (notesOnly) toast.success("Notas salvas neste card");
      }

      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[min(90dvh,calc(100svh-1rem))] min-h-0 flex flex-col overflow-hidden ape-overlay-scroll sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{notesOnly ? "Anotar card atual" : "Editar Flashcard"}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 py-4 ape-overlay-scroll">
          {!notesOnly && (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-term">{labelA || "Lado A"}</Label>
                <Input
                  id="edit-term"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder={`Conteúdo do ${labelA || "Lado A"}`}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-translation">{labelB || "Lado B"}</Label>
                <Input
                  id="edit-translation"
                  value={translation}
                  onChange={(event) => setTranslation(event.target.value)}
                  placeholder={`Conteúdo do ${labelB || "Lado B"}`}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-hint">Descrição / Dica (opcional)</Label>
                <Textarea
                  id="edit-hint"
                  value={hint}
                  onChange={(event) => setHint(event.target.value)}
                  placeholder="Adicione uma explicação, observação ou dica para este card (opcional)"
                  rows={2}
                />
              </div>
            </>
          )}

          {showRichNotes && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div>
                <div className="text-sm font-semibold">Notas e explicações</div>
                <p className="text-xs text-muted-foreground">
                  Salvas diretamente neste card. Você pode pesquisar uma dúvida e colar a explicação aqui sem perder a partida.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-detailed-explanation">Explicação detalhada</Label>
                <Textarea
                  id="edit-detailed-explanation"
                  value={detailedExplanation}
                  onChange={(event) => setDetailedExplanation(event.target.value)}
                  placeholder="Cole aqui uma explicação completa do contexto, gramática ou uso deste card."
                  rows={6}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-short-explanation">Explicação curta</Label>
                <Textarea
                  id="edit-short-explanation"
                  value={shortExplanation}
                  onChange={(event) => setShortExplanation(event.target.value)}
                  placeholder="Resumo curto para consulta rápida."
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-usage-notes">Observações de uso</Label>
                <Textarea
                  id="edit-usage-notes"
                  value={usageNotes}
                  onChange={(event) => setUsageNotes(event.target.value)}
                  placeholder="Quando usar, registro, contexto, combinações naturais..."
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-common-mistakes">Erros comuns</Label>
                <Textarea
                  id="edit-common-mistakes"
                  value={commonMistakes}
                  onChange={(event) => setCommonMistakes(event.target.value)}
                  placeholder="Confusões ou erros que você quer lembrar de evitar."
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-note-text">Notas rápidas</Label>
                <Textarea
                  id="edit-note-text"
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="Uma nota por linha."
                  rows={3}
                />
              </div>
            </div>
          )}

          {showImages && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                Imagens (opcional)
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="edit-image-a" className="text-xs">Imagem Lado A</Label>
                  <Input
                    id="edit-image-a"
                    value={imageUrlA}
                    onChange={(event) => setImageUrlA(event.target.value)}
                    placeholder="https://..."
                    type="url"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-image-b" className="text-xs">Imagem Lado B</Label>
                  <Input
                    id="edit-image-b"
                    value={imageUrlB}
                    onChange={(event) => setImageUrlB(event.target.value)}
                    placeholder="https://..."
                    type="url"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {showWordHints && (
            <WordHintEditor
              value={wordHints}
              onChange={setWordHints}
              sourceText={term}
              sourceTextB={translation}
              labelA={labelA || "Lado A"}
              labelB={labelB || "Lado B"}
            />
          )}

          {showLayers && flashcard && meta && (
            <LayeredCardEditor
              principalId={flashcard.id}
              listId={meta.listId}
              term={term || flashcard.term}
              translation={translation || flashcard.translation}
              labelA={labelA || "Lado A"}
              labelB={labelB || "Lado B"}
            />
          )}
        </div>

        <DialogFooter className="border-t pt-2 pb-[max(.75rem,env(safe-area-inset-bottom,0px))]">
          <Button variant="outline" className="min-h-11 touch-manipulation" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            className="min-h-11 touch-manipulation"
            onClick={handleSave}
            disabled={saving || (!notesOnly && (!term.trim() || !translation.trim()))}
          >
            {saving ? "Salvando..." : notesOnly ? "Salvar notas" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
