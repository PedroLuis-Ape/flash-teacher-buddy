import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Trash2, Gamepad2, Share2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface CollectionCardProps {
  id: string;
  name: string;
  description?: string;
  flashcardCount: number;
  visibility?: string;
  onSelect: () => void;
  onDelete: () => void;
  onToggleShare: () => void;
}

export const CollectionCard = ({
  id,
  name,
  description,
  flashcardCount,
  visibility = "private",
  onSelect,
  onDelete,
  onToggleShare,
}: CollectionCardProps) => {
  const navigate = useNavigate();
  const isPublic = visibility === "public";

  const handleDelete = async () => {
    const { error } = await supabase.from("collections").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir coleção");
      return;
    }

    toast.success("Coleção excluída!");
    onDelete();
  };

  const handleToggleShare = async () => {
    const newVisibility = isPublic ? "private" : "public";
    
    const { error } = await supabase
      .from("collections")
      .update({ visibility: newVisibility })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar compartilhamento");
      return;
    }

    toast.success(isPublic ? "Compartilhamento desativado!" : "Compartilhamento ativado!");
    onToggleShare();
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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {flashcardCount} flashcard{flashcardCount !== 1 ? "s" : ""}
          </span>
          <Button
            variant={isPublic ? "default" : "outline"}
            size="sm"
            onClick={handleToggleShare}
            className="gap-2"
          >
            {isPublic ? (
              <>
                <Share2 className="h-4 w-4" />
                Compartilhado
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Privado
              </>
            )}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate(`/collection/${id}/games`)}
            className="flex-1"
          >
            <Gamepad2 className="mr-2 h-4 w-4" />
            Estudar
          </Button>
          <Button onClick={onSelect} variant="secondary" size="sm" className="flex-1">
            Ver Flashcards
          </Button>
        </div>
      </div>
    </Card>
  );
};
