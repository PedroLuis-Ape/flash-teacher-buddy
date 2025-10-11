import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, ListPlus, FileText, CreditCard, Trash2, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ListType {
  id: string;
  title: string;
  description: string | null;
  card_count?: number;
}

interface FolderType {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
}

const Folder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [folder, setFolder] = useState<FolderType | null>(null);
  const [lists, setLists] = useState<ListType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<ListType | null>(null);
  const [newList, setNewList] = useState({ title: "", description: "" });

  useEffect(() => {
    loadFolder();
    loadLists();
  }, [id]);

  const loadFolder = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setFolder(data);
      setIsOwner(session?.user?.id === data.owner_id);
    } catch (error: any) {
      toast.error("Erro ao carregar pasta: " + error.message);
      navigate("/folders");
    }
  };

  const loadLists = async () => {
    setLoading(true);
    try {
      const { data: listsData, error } = await supabase
        .from("lists")
        .select("*")
        .eq("folder_id", id)
        .order("order_index", { ascending: true });

      if (error) throw error;

      const listsWithCounts = await Promise.all(
        (listsData || []).map(async (list) => {
          const { count } = await supabase
            .from("flashcards")
            .select("*", { count: "exact", head: true })
            .eq("list_id", list.id);

          return {
            ...list,
            card_count: count || 0,
          };
        })
      );

      setLists(listsWithCounts);
    } catch (error: any) {
      toast.error("Erro ao carregar listas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newList.title.trim()) {
      toast.error("O título é obrigatório");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("lists")
        .insert({
          folder_id: id,
          title: newList.title,
          description: newList.description,
          owner_id: session.user.id,
          order_index: lists.length,
        });

      if (error) throw error;

      toast.success("Lista criada com sucesso!");
      setDialogOpen(false);
      setNewList({ title: "", description: "" });
      loadLists();
    } catch (error: any) {
      toast.error("Erro ao criar lista: " + error.message);
    }
  };

  const handleEditList = (list: ListType) => {
    setEditingList(list);
    setEditDialogOpen(true);
  };

  const handleUpdateList = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingList || !editingList.title.trim()) {
      toast.error("O título é obrigatório");
      return;
    }

    try {
      const { error } = await supabase
        .from("lists")
        .update({
          title: editingList.title,
          description: editingList.description,
        })
        .eq("id", editingList.id);

      if (error) throw error;

      toast.success("Lista atualizada com sucesso!");
      setEditDialogOpen(false);
      setEditingList(null);
      loadLists();
    } catch (error: any) {
      toast.error("Erro ao atualizar lista: " + error.message);
    }
  };

  const handleDeleteList = async (listId: string) => {
    try {
      const { error } = await supabase
        .from("lists")
        .delete()
        .eq("id", listId);

      if (error) throw error;

      toast.success("Lista excluída com sucesso!");
      loadLists();
    } catch (error: any) {
      toast.error("Erro ao excluir lista: " + error.message);
    }
  };

  if (!folder) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/auth", { replace: true });
              }
            }}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          
          <h1 className="text-3xl font-bold">{folder.title}</h1>
          {folder.description && (
            <p className="text-muted-foreground mt-2">{folder.description}</p>
          )}
        </div>

        {isOwner && (
          <div className="mb-6">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg">
                  <ListPlus className="mr-2 h-5 w-5" />
                  Nova Lista
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Lista</DialogTitle>
                  <DialogDescription>
                    Adicione uma nova lista de flashcards nesta pasta
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateList}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Título</Label>
                      <Input
                        id="title"
                        value={newList.title}
                        onChange={(e) => setNewList({ ...newList, title: e.target.value })}
                        placeholder="Ex: Verbos Irregulares"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição (opcional)</Label>
                      <Textarea
                        id="description"
                        value={newList.description}
                        onChange={(e) => setNewList({ ...newList, description: e.target.value })}
                        placeholder="Descreva o conteúdo desta lista..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Criar Lista</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {loading ? (
          <p className="text-center text-muted-foreground">Carregando...</p>
        ) : lists.length === 0 ? (
          <Card className="text-center p-12">
            <CardHeader>
              <CardTitle>Nenhuma lista ainda</CardTitle>
              <CardDescription>
                {isOwner
                  ? "Crie sua primeira lista de flashcards"
                  : "Esta pasta ainda não possui listas"}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lists.map((list) => (
              <Card
                key={list.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div onClick={() => navigate(`/list/${list.id}`)}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <FileText className="h-8 w-8 text-primary" />
                      {isOwner && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditList(list);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. Todos os flashcards desta lista também serão excluídos.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteList(list.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                    <CardTitle className="mt-4">{list.title}</CardTitle>
                  {list.description && (
                    <CardDescription>{list.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <CreditCard className="h-4 w-4" />
                    <span>{list.card_count || 0} cards</span>
                  </div>
                </CardContent>
              </div>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Lista</DialogTitle>
              <DialogDescription>
                Altere o título e descrição da lista
              </DialogDescription>
            </DialogHeader>
            {editingList && (
              <form onSubmit={handleUpdateList}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-list-title">Título</Label>
                    <Input
                      id="edit-list-title"
                      value={editingList.title}
                      onChange={(e) => setEditingList({ ...editingList, title: e.target.value })}
                      placeholder="Ex: Verbos Irregulares"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-list-description">Descrição (opcional)</Label>
                    <Textarea
                      id="edit-list-description"
                      value={editingList.description || ""}
                      onChange={(e) => setEditingList({ ...editingList, description: e.target.value })}
                      placeholder="Descreva o conteúdo desta lista..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Salvar Alterações</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Folder;
