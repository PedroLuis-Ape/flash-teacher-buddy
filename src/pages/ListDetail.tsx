import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  front: string;
  back: string;
  audio_url: string | null;
}

const ListDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [list, setList] = useState<ListType | null>(null);
  const [folder, setFolder] = useState<FolderType | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    loadList();
    loadFlashcards();
  }, [id]);

  const loadList = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Tentar carregar via RPC público primeiro (para alunos sem login)
      if (!session) {
        const { data: publicLists } = await supabase.rpc('get_portal_lists', { 
          _folder_id: '' // Vamos buscar pela lista diretamente
        });
        
        // Como não temos RPC específico para lista individual, vamos usar query normal
        // que deve funcionar se as RLS policies estiverem corretas
        const { data: listData, error: listError } = await supabase
          .from("lists")
          .select("*")
          .eq("id", id)
          .single();

        if (listError) {
          console.error("Erro ao carregar lista pública:", listError);
          toast.error("Lista não encontrada ou não está compartilhada");
          navigate("/portal");
          return;
        }

        setList(listData);
        setIsOwner(false);

        const { data: folderData } = await supabase.rpc('get_portal_folder', { 
          _id: listData.folder_id 
        });

        if (folderData) {
          setFolder(folderData);
        }
        return;
      }

      // Fluxo normal para usuários logados
      const { data: listData, error: listError } = await supabase
        .from("lists")
        .select("*")
        .eq("id", id)
        .single();

      if (listError) throw listError;

      setList(listData);
      setIsOwner(session?.user?.id === listData.owner_id);

      const { data: folderData, error: folderError } = await supabase
        .from("folders")
        .select("id, title, visibility")
        .eq("id", listData.folder_id)
        .single();

      if (folderError) throw folderError;
      setFolder(folderData);
    } catch (error: any) {
      toast.error("Erro ao carregar lista: " + error.message);
      navigate("/folders");
    }
  };

  const loadFlashcards = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Se não tiver sessão, usar RPC público
      if (!session) {
        const { data, error } = await supabase.rpc('get_portal_flashcards', { 
          _list_id: id 
        });

        if (error) {
          console.error("Erro ao carregar flashcards públicos:", error);
          setFlashcards([]);
        } else {
          setFlashcards(data || []);
        }
      } else {
        // Fluxo normal para usuários logados
        const { data, error } = await supabase
          .from("flashcards")
          .select("*")
          .eq("list_id", id)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setFlashcards(data || []);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar flashcards: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFlashcard = async (front: string, back: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("flashcards")
        .insert({
          list_id: id,
          user_id: session.user.id,
          front,
          back,
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

  const handleUpdateFlashcard = async (id: string, front: string, back: string) => {
    try {
      const { error } = await supabase
        .from("flashcards")
        .update({ front, back })
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

      setFolder({ ...folder, visibility: newVisibility });
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

  if (!list || !folder) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
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
          
          <div className="flex items-center justify-between">
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
            <div className="flex items-center justify-between">
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
                  existingCards={flashcards.map(f => ({ front: f.front, back: f.back }))}
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
                      <p className="font-semibold text-lg mb-2">{flashcard.front}</p>
                      <p className="text-muted-foreground">{flashcard.back}</p>
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
