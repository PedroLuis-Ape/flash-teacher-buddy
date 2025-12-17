import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface CreateFlashcardFormProps {
  onAdd: (term: string, translation: string, hint?: string) => void;
  labelA?: string;
  labelB?: string;
}

export const CreateFlashcardForm = ({ 
  onAdd,
  labelA = "Lado A (Termo)",
  labelB = "Lado B (Tradução)",
}: CreateFlashcardFormProps) => {
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [hint, setHint] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!term.trim() || !translation.trim()) {
      toast.error("Preencha ambos os campos!");
      return;
    }

    onAdd(term, translation, hint.trim() || undefined);
    setTerm("");
    setTranslation("");
    setHint("");
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

        <Button type="submit" className="w-full" size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Adicionar Flashcard
        </Button>
      </form>
    </Card>
  );
};
