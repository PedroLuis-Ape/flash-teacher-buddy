import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Plus, FileText, ChevronRight } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Notes() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const { notes, loading, createNote } = useNotes(userId);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
      } else {
        navigate("/auth");
      }
    });
  }, [navigate]);

  const handleCreateNote = async () => {
    setCreating(true);
    const newNote = await createNote();
    if (newNote) {
      navigate(`/notes/${newNote.id}`);
    }
    setCreating(false);
  };

  const getPreview = (content: string) => {
    if (!content) return "Nota vazia";
    const firstLine = content.split("\n")[0];
    return firstLine.length > 60 ? firstLine.slice(0, 60) + "..." : firstLine;
  };

  if (loading || !userId) {
    return <LoadingSpinner message="Carregando notas..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Minhas Notas" showBack />

      <div className="container max-w-2xl mx-auto p-4 space-y-3">
        {notes.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma nota ainda</h3>
            <p className="text-muted-foreground mb-4">
              Crie sua primeira nota para começar
            </p>
            <Button onClick={handleCreateNote} disabled={creating}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Nota
            </Button>
          </Card>
        ) : (
          <>
            {notes.map((note) => (
              <Card
                key={note.id}
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate(`/notes/${note.id}`)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">
                      {note.title || "Sem título"}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {getPreview(note.content)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(note.updated_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </Card>
            ))}

            {/* FAB para criar nova nota */}
            <Button
              onClick={handleCreateNote}
              disabled={creating}
              className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
              size="icon"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
