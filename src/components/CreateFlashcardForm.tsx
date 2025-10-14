import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface CreateFlashcardFormProps {
  onAdd: (term: string, translation: string) => void;
}

export const CreateFlashcardForm = ({ onAdd }: CreateFlashcardFormProps) => {
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!term.trim() || !translation.trim()) {
      toast.error("Preencha ambos os campos!");
      return;
    }

    onAdd(term, translation);
    setTerm("");
    setTranslation("");
    toast.success("Flashcard criado com sucesso!");
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-muted/10 shadow-[var(--shadow-card)]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="term" className="text-foreground">
            Português
          </Label>
          <Input
            id="term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Digite a palavra em português..."
            className="bg-background"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="translation" className="text-foreground">
            English
          </Label>
          <Input
            id="translation"
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            placeholder="Type the word in English..."
            className="bg-background"
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
