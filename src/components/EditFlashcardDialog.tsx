import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageIcon } from "lucide-react";
import { supportsImages } from "@/features/study/lib/studyTypeConfig";
import { WordHintEditor } from "@/features/study/components/WordHintEditor";
import { parseWordHints, type WordHint } from "@/features/study/lib/wordHints";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { LayeredCardEditor } from "@/features/cards/components/LayeredCardEditor";
import { supabase } from "@/integrations/supabase/client";

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
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, term: string, translation: string, hint: string, imageUrlA?: string, imageUrlB?: string, wordHints?: WordHint[]) => Promise<void>;
  studyType?: string;
  labelA?: string;
  labelB?: string;
}

export const EditFlashcardDialog = ({ flashcard, isOpen, onClose, onSave, studyType = "language", labelA, labelB }: EditFlashcardDialogProps) => {
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [hint, setHint] = useState("");
  const [imageUrlA, setImageUrlA] = useState("");
  const [imageUrlB, setImageUrlB] = useState("");
  const [wordHints, setWordHints] = useState<WordHint[]>([]);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<{ listId: string; userId: string } | null>(null);

  const showImages = supportsImages(studyType);
  const showWordHints = studyType === "language";
  const showLayers =
    FEATURE_FLAGS.layered_cards &&
    !!flashcard &&
    !flashcard.parent_card_id; // hide editor on a layer itself; only show on principals/standalone

  useEffect(() => {
    if (flashcard) {
      setTerm(flashcard.term);
      setTranslation(flashcard.translation);
      setHint(flashcard.hint || "");
      setImageUrlA(flashcard.image_url_a || "");
      setImageUrlB(flashcard.image_url_b || "");
      setWordHints(parseWordHints(flashcard.word_hints));
    }
  }, [flashcard]);

  // Resolve list_id/user_id for the layer editor when not passed in props.
  useEffect(() => {
    if (!FEATURE_FLAGS.layered_cards || !flashcard || !isOpen) return;
    if (flashcard.list_id && flashcard.user_id) {
      setMeta({ listId: flashcard.list_id, userId: flashcard.user_id });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("flashcards")
        .select("list_id, user_id")
        .eq("id", flashcard.id)
        .maybeSingle();
      if (!cancelled && data) {
        setMeta({ listId: (data as any).list_id, userId: (data as any).user_id });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flashcard, isOpen]);

  const handleSave = async () => {
    if (!flashcard || !term.trim() || !translation.trim()) return;
    
    const validHints = wordHints.filter(h => h.text.trim() && h.translation.trim());

    setSaving(true);
    try {
      await onSave(
        flashcard.id,
        term.trim(),
        translation.trim(),
        hint.trim(),
        imageUrlA.trim() || undefined,
        imageUrlB.trim() || undefined,
        validHints.length > 0 ? validHints : undefined,
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Flashcard</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-term">{labelA || "Lado A"}</Label>
            <Input
              id="edit-term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={`Conteúdo do ${labelA || "Lado A"}`}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-translation">{labelB || "Lado B"}</Label>
            <Input
              id="edit-translation"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              placeholder={`Conteúdo do ${labelB || "Lado B"}`}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-hint">Descrição / Dica (opcional)</Label>
            <Textarea
              id="edit-hint"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Adicione uma explicação, observação ou dica para este card (opcional)"
              rows={2}
            />
          </div>

          {showImages && (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
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
                    onChange={(e) => setImageUrlA(e.target.value)}
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
                    onChange={(e) => setImageUrlB(e.target.value)}
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
              userId={meta.userId}
              term={term || flashcard.term}
            />
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !term.trim() || !translation.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
