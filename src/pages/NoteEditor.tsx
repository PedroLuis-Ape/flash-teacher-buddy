import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function NoteEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const fetchNote = async () => {
      if (!id) {
        navigate("/notes");
        return;
      }

      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          navigate("/auth");
          return;
        }

        const { data, error } = await supabase
          .from("notes")
          .select("*")
          .eq("id", id)
          .single();

        if (error || !data) {
          toast.error("Nota não encontrada");
          navigate("/notes");
          return;
        }

        const noteData = data as Note;
        setNote(noteData);
        setTitle(noteData.title);
        setContent(noteData.content);
      } catch (error) {
        console.error("Error fetching note:", error);
        toast.error("Erro ao carregar nota");
        navigate("/notes");
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [id, navigate]);

  useEffect(() => {
    if (note) {
      const changed = title !== note.title || content !== note.content;
      setHasChanges(changed);
    }
  }, [title, content, note]);

  // Warn on navigation with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  const handleSave = async () => {
    if (!id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("notes")
        .update({ title, content })
        .eq("id", id);

      if (error) throw error;

      setNote((prev) =>
        prev ? { ...prev, title, content, updated_at: new Date().toISOString() } : null
      );
      setHasChanges(false);
      toast.success("Nota salva!");
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Erro ao salvar nota");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      const { error } = await supabase.from("notes").delete().eq("id", id);

      if (error) throw error;

      toast.success("Nota apagada");
      navigate("/notes");
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Erro ao apagar nota");
    }
  };

  const handleBack = useCallback(() => {
    if (hasChanges) {
      const confirmed = window.confirm("Você tem alterações não salvas. Deseja sair mesmo assim?");
      if (!confirmed) return;
    }
    navigate("/notes");
  }, [hasChanges, navigate]);

  if (loading) {
    return <LoadingSpinner message="Carregando nota..." />;
  }

  if (!note) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ApeAppBar
        title={hasChanges ? "Nota *" : "Nota"}
        showBack
        onBack={handleBack}
        rightContent={
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive">
                  <Trash2 className="h-5 w-5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar nota?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. A nota será permanentemente removida.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Apagar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="gap-1"
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        }
      />

      <div className="container max-w-2xl mx-auto p-4 flex-1 flex flex-col gap-4">
        <Input
          placeholder="Título da nota"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-medium"
        />
        <Textarea
          placeholder="Escreva sua nota aqui..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 min-h-[300px] resize-none"
        />
      </div>
    </div>
  );
}
