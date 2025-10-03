import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CollectionCardProps {
  id: string;
  name: string;
  description?: string;
  flashcardCount: number;
  onSelect: () => void;
  onDelete: () => void;
}

export const CollectionCard = ({
  id,
  name,
  description,
  flashcardCount,
  onSelect,
  onDelete,
}: CollectionCardProps) => {
  const handleDelete = async () => {
    const { error } = await supabase.from("collections").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir coleção");
      return;
    }

    toast.success("Coleção excluída!");
    onDelete();
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-muted/10 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition-all duration-300">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-semibold">{name}</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {description && (
        <p className="text-muted-foreground mb-4">{description}</p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {flashcardCount} flashcard{flashcardCount !== 1 ? "s" : ""}
        </span>
        <Button onClick={onSelect} size="sm">
          Abrir
        </Button>
      </div>
    </Card>
  );
};
