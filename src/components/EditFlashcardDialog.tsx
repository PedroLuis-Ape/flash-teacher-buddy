import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface EditFlashcardDialogProps {
  flashcard: {
    id: string;
    term: string;
    translation: string;
    hint?: string | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, term: string, translation: string, hint: string) => Promise<void>;
}

export const EditFlashcardDialog = ({ flashcard, isOpen, onClose, onSave }: EditFlashcardDialogProps) => {
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [hint, setHint] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (flashcard) {
      setTerm(flashcard.term);
      setTranslation(flashcard.translation);
      setHint(flashcard.hint || "");
    }
  }, [flashcard]);

  const handleSave = async () => {
    if (!flashcard || !term.trim() || !translation.trim()) return;
    
    setSaving(true);
    try {
      await onSave(flashcard.id, term.trim(), translation.trim(), hint.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Flashcard</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-term">Português</Label>
            <Input
              id="edit-term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Termo em português"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-translation">English</Label>
            <Input
              id="edit-translation"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              placeholder="Translation in English"
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
