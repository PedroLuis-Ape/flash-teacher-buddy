import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supportsImages } from "@/features/study/lib/studyTypeConfig";
import { WordHintEditor } from "@/features/study/components/WordHintEditor";
import type { WordHint } from "@/features/study/lib/wordHints";

interface CreateFlashcardFormProps {
  onAdd: (term: string, translation: string, hint?: string, imageUrlA?: string, imageUrlB?: string, wordHints?: WordHint[]) => void;
  labelA?: string;
  labelB?: string;
  studyType?: string;
}

export const CreateFlashcardForm = ({ 
  onAdd,
  labelA = "Lado A (Termo)",
  labelB = "Lado B (Tradução)",
  studyType = "language",
}: CreateFlashcardFormProps) => {
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [hint, setHint] = useState("");
  const [imageUrlA, setImageUrlA] = useState("");
  const [imageUrlB, setImageUrlB] = useState("");
  const [wordHints, setWordHints] = useState<WordHint[]>([]);

  const showImages = supportsImages(studyType);
  const showWordHints = studyType === "language";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!term.trim() || !translation.trim()) {
      toast.error("Preencha ambos os campos!");
      return;
    }

    // Filter out empty word hints before saving
    const validHints = wordHints.filter(h => h.text.trim() && h.translation.trim());

    onAdd(
      term,
      translation,
      hint.trim() || undefined,
      imageUrlA.trim() || undefined,
      imageUrlB.trim() || undefined,
      validHints.length > 0 ? validHints : undefined,
    );
    setTerm("");
    setTranslation("");
    setHint("");
    setImageUrlA("");
    setImageUrlB("");
    setWordHints([]);
    toast.success("Flashcard criado com sucesso!");
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-muted/10 shadow-[var(--shadow-card)]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="term" className="text-foreground">
            {labelA}
          </Label>
          <Input
            id="term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={`Digite o conteúdo para ${labelA}...`}
            className="bg-background"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="translation" className="text-foreground">
            {labelB}
          </Label>
          <Input
            id="translation"
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            placeholder={`Digite o conteúdo para ${labelB}...`}
            className="bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hint" className="text-foreground flex items-center gap-2">
            Descrição / Dica 
            <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Textarea
            id="hint"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="Adicione uma explicação, observação ou dica para este card..."
            className="bg-background resize-none"
            rows={2}
          />
        </div>

        {showImages && (
          <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              Imagens (opcional — cole URL externa)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="image-url-a" className="text-xs">Imagem Lado A</Label>
                <Input
                  id="image-url-a"
                  value={imageUrlA}
                  onChange={(e) => setImageUrlA(e.target.value)}
                  placeholder="https://..."
                  className="bg-background text-sm"
                  type="url"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="image-url-b" className="text-xs">Imagem Lado B</Label>
                <Input
                  id="image-url-b"
                  value={imageUrlB}
                  onChange={(e) => setImageUrlB(e.target.value)}
                  placeholder="https://..."
                  className="bg-background text-sm"
                  type="url"
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
            labelA={labelA}
            labelB={labelB}
          />
        )}

        <Button type="submit" className="w-full" size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Adicionar Flashcard
        </Button>
      </form>
    </Card>
  );
};
