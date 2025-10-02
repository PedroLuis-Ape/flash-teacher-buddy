import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface CreateFlashcardFormProps {
  onAdd: (front: string, back: string) => void;
}

export const CreateFlashcardForm = ({ onAdd }: CreateFlashcardFormProps) => {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!front.trim() || !back.trim()) {
      toast.error("Preencha ambos os campos!");
      return;
    }

    onAdd(front, back);
    setFront("");
    setBack("");
    toast.success("Flashcard criado com sucesso!");
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-muted/10 shadow-[var(--shadow-card)]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="front" className="text-foreground">
            Português
          </Label>
          <Input
            id="front"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder="Digite a palavra em português..."
            className="bg-background"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="back" className="text-foreground">
            English
          </Label>
          <Input
            id="back"
            value={back}
            onChange={(e) => setBack(e.target.value)}
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
