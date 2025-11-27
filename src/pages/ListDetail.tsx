import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Play, Trash2, Share2, Copy } from "lucide-react";
import { CreateFlashcardForm } from "@/components/CreateFlashcardForm";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ListType {
  id: string;
  title: string;
  description: string | null;
  folder_id: string;
  owner_id: string;
}

interface FolderType {
  id: string;
  title: string;
  visibility: string;
}

interface Flashcard {
  id: string;
  term: string;
  translation: string;
  hint?: string | null;
  audio_url: string | null;
}

const ListDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isOwner, setIsOwner] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ["list", id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("lists")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      
      if (error) throw error;
      if (data) {
        setIsOwner(session?.user?.id === data.owner_id);
      }
      return data as ListType | null;
    },
    staleTime: 60_000,
  });

  const { data: folder, isLoading: folderLoading } = useQuery({
    queryKey: ["folder", list?.folder_id],
    queryFn: async () => {
      if (!list?.folder_id) return null;
      const { data, error } = await supabase
        .from("folders")
        .select("id, title, visibility")
        .eq("id", list.folder_id)
        .maybeSingle();
      
      if (error) throw error;
      return data as FolderType | null;
    },
    enabled: !!list?.folder_id,
    staleTime: 60_000,
  });

  const { data: flashcards = [], isLoading: flashcardsLoading, refetch: loadFlashcards } = useQuery({
    queryKey: ["flashcards", id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        const { data, error } = await supabase.rpc('get_portal_flashcards', { 
          _list_id: id 
        });
        if (error) throw error;
        return data as Flashcard[];
      }
      
      const { data, error } = await supabase
        .from("flashcards")
        .select("*")
        .eq("list_id", id)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as Flashcard[];
    },
    staleTime: 30_000,
  });


  const handleAddFlashcard = async (term: string, translation: string, hint?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("flashcards")
        .insert({
          list_id: id,
          user_id: session.user.id,
          term,
          translation,
          hint: hint || null,
        });

      if (error) throw error;
      loadFlashcards();
    } catch (error: any) {
      toast.error("Erro ao adicionar flashcard: " + error.message);
    }
  };

  const handleDeleteFlashcard = async (flashcardId: string) => {
    try {
      const { error } = await supabase
        .from("flashcards")
        .delete()
        .eq("id", flashcardId);

      if (error) throw error;
      toast.success("Flashcard excluído!");
      loadFlashcards();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const handleUpdateFlashcard = async (id: string, term: string, translation: string) => {
    try {
      const { error } = await supabase
        .from("flashcards")
        .update({ term, translation })
        .eq("id", id);

      if (error) throw error;
      toast.success("Flashcard atualizado!");
      loadFlashcards();
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    }
  };

  const handleToggleSharing = async () => {
    if (!folder) return;
    
    setIsSharing(true);
    try {
      const newVisibility = folder.visibility === 'class' ? 'private' : 'class';
      
      const { error } = await supabase
        .from("folders")
        .update({ visibility: newVisibility })
        .eq("id", folder.id);

      if (error) throw error;

      toast.success(
        newVisibility === 'class' 
          ? "Pasta compartilhada com sucesso!" 
          : "Compartilhamento desativado"
      );
    } catch (error: any) {
      toast.error("Erro ao alterar compartilhamento: " + error.message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!folder) return;
    const shareUrl = `${window.location.origin}/share/folder/${folder.id}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copiado para a área de transferência!");
  };

  const loading = listLoading || flashcardsLoading || folderLoading;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!list) {
    return <div className="min-h-screen flex items-center justify-center">Lista não encontrada</div>;
  }

  if (!folder) {
    return <div className="min-h-screen flex items-center justify-center">Pasta não encontrada</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(isOwner ? `/folder/${list.folder_id}` : `/portal/folder/${list.folder_id}`)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          
          <div className="flex flex-wrap items-center justify-between gap-2"> {/* PATCH: wrap no mobile */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">{folder.title}</p>
              <h1 className="text-3xl font-bold">{list.title}</h1>
              {list.description && (
                <p className="text-muted-foreground mt-2">{list.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {flashcards.length > 0 && (
                <Button
                  size="lg"
                  onClick={() => navigate(isOwner ? `/list/${id}/games` : `/portal/list/${id}/games`)}
                >
                  <Play className="mr-2 h-5 w-5" />
                  Estudar
                </Button>
              )}
            </div>
          </div>
        </div>

        {isOwner && (
          <Card className="p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2"> {/* PATCH: wrap no mobile */}
              <div className="flex items-center gap-3">
                <Switch
                  id="share-mode"
                  checked={folder.visibility === 'class'}
                  onCheckedChange={handleToggleSharing}
                  disabled={isSharing}
                />
                <Label htmlFor="share-mode" className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    <span className="font-semibold">
                      {folder.visibility === 'class' ? "Pasta Compartilhada" : "Compartilhar Pasta"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground font-normal">
                    {folder.visibility === 'class' 
                      ? "Alunos podem acessar via link" 
                      : "Ative para gerar link de acesso"}
                  </p>
                </Label>
              </div>
              {folder.visibility === 'class' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyShareLink}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Link
                </Button>
              )}
            </div>
          </Card>
        )}

        <div className="space-y-8">
          {isOwner && (
            <div className="flex gap-4">
              <div className="flex-1">
                <CreateFlashcardForm onAdd={handleAddFlashcard} />
              </div>
              <div className="flex items-start">
                <BulkImportDialog
                  collectionId={id!}
                  existingCards={flashcards.map(f => ({ term: f.term, translation: f.translation }))}
                  onImported={loadFlashcards}
                />
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : flashcards.length === 0 ? (
            <Card className="text-center p-12">
              <p className="text-muted-foreground">
                {isOwner
                  ? "Nenhum flashcard ainda. Adicione o primeiro!"
                  : "Esta lista ainda não possui flashcards."}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {flashcards.map((flashcard) => (
                <Card key={flashcard.id} className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-lg mb-2">{flashcard.term}</p>
                      <p className="text-muted-foreground">{flashcard.translation}</p>
                      {flashcard.hint && (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          💡 {flashcard.hint}
                        </p>
                      )}
                    </div>
                    {isOwner && (
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteFlashcard(flashcard.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListDetail;
