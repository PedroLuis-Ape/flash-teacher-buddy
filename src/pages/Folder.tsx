import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ArrowLeft, ListPlus, FileText, CreditCard, Trash2, Pencil, Share2, Play } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { VideoList } from "@/components/VideoList";
import { naturalSort } from "@/lib/sorting";
import { ListStudyTypeSelector, ListStudySettings, getDefaultListStudySettings, settingsToDbColumns } from "@/components/ListStudyTypeSelector";

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
  const [newListStudySettings, setNewListStudySettings] = useState<ListStudySettings>(getDefaultListStudySettings());
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [allowPublicPortal, setAllowPublicPortal] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  useEffect(() => {
    loadFolder();
    loadLists();
  }, [id]);

  const loadFolder = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // First try direct query (works for owners due to RLS)
        const { data: directData, error: directError } = await supabase
          .from("folders")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        
        if (directData) {
          // Got folder directly (user is owner)
          setFolder(directData);
          setIsOwner(session.user.id === directData.owner_id);
        } else {
          // If RLS blocked or not owner, use edge function for student access
          console.log("[Folder] Direct query failed, trying edge function for student access");
          
          const { data: edgeFnData, error: edgeFnError } = await supabase.functions.invoke('get-folder-full', {
            body: { folder_id: id }
          });
          
          if (edgeFnError) {
            console.error("[Folder] Edge function error:", edgeFnError);
            toast.error("Pasta não encontrada ou sem permissão");
            navigate("/folders");
            return;
          }
          
          if (!edgeFnData?.folder) {
            console.log("[Folder] No folder returned from edge function");
            toast.error("Pasta não encontrada ou sem permissão");
            navigate("/folders");
            return;
          }
          
          console.log("[Folder] Loaded via edge function:", edgeFnData.folder.title);
          setFolder(edgeFnData.folder);
          setIsOwner(session.user.id === edgeFnData.folder.owner_id);
          
          // Also set lists if returned by edge function
          if (edgeFnData.lists) {
            setLists(edgeFnData.lists.map((l: any) => ({
              id: l.id,
              title: l.title,
              description: l.description,
              card_count: l.cards_count || 0,
            })));
            setLoading(false);
          }
        }
      } else {
        // Acesso público via portal
        const { data, error } = await supabase.rpc('get_portal_folder', { _id: id });
        
        if (error) {
          console.error("Erro RPC get_portal_folder:", error);
          toast.error("Pasta não encontrada ou não está compartilhada");
          navigate("/portal");
          return;
        }
        
        if (!data) {
          console.log("Nenhuma pasta retornada do RPC");
          toast.error("Pasta não encontrada ou não está compartilhada");
          navigate("/portal");
          return;
        }
        
        console.log("Pasta carregada via portal:", data);
        setFolder(data as any);
        setIsOwner(false);
      }
    } catch (error: any) {
      console.error("Erro ao carregar pasta:", error);
      toast.error("Erro ao carregar pasta: " + error.message);
      const { data: { session } } = await supabase.auth.getSession();
      navigate(session ? "/folders" : "/portal");
    }
  };

  const loadLists = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Use RPC to get lists with card counts in a single query (eliminates N+1)
      if (session) {
        const { data, error } = await supabase.rpc('get_lists_with_card_counts', { 
          _folder_id: id 
        });
        if (error) throw error;
        setLists((data as any[]) || []);
      } else {
        // Public portal access - use RPC with counts
        const { data, error } = await supabase.rpc('get_portal_lists_with_counts', { 
          _folder_id: id 
        });
        
        if (error) {
          console.error("Erro RPC get_portal_lists_with_counts:", error);
        }
        
        setLists((data as any[]) || []);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar listas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!editTitle.trim() || !folder) return;
    
    setIsSavingTitle(true);
    try {
      const { error } = await supabase
        .from("folders")
        .update({ title: editTitle.trim() })
        .eq("id", folder.id);
      
      if (error) throw error;
      
      setFolder({ ...folder, title: editTitle.trim() });
      setIsEditingTitle(false);
      toast.success("Título atualizado!");
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleShareFolder = async () => {
    setSharing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Faça login para compartilhar");
      
      // Update folder visibility
      const { error: folderError } = await supabase
        .from("folders")
        .update({ visibility: "class" })
        .eq("id", id);
      
      if (folderError) throw folderError;

      // Update all lists in folder
      const { error: listsError } = await supabase
        .from("lists")
        .update({ visibility: "class" })
        .eq("folder_id", id as string);
      
      if (listsError) throw listsError;

      // Enable public portal access if requested
      if (allowPublicPortal) {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            { id: session.user.id, public_access_enabled: true },
            { onConflict: "id" }
          );
        
        if (profileError) throw profileError;
      }

      toast.success("Pasta compartilhada com sucesso!");
      setShareDialogOpen(false);
    } catch (error: any) {
      toast.error("Erro ao compartilhar: " + error.message);
    } finally {
      setSharing(false);
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

      const studyDbColumns = settingsToDbColumns(newListStudySettings);

      const { data: createdList, error } = await supabase
        .from("lists")
        .insert({
          folder_id: id,
          title: newList.title,
          description: newList.description,
          owner_id: session.user.id,
          order_index: lists.length,
          ...studyDbColumns,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Lista criada! Edite o conteúdo abaixo.");
      setDialogOpen(false);
      setNewList({ title: "", description: "" });
      setNewListStudySettings(getDefaultListStudySettings());
      
      // Navegar automaticamente para a lista criada
      if (createdList) {
        navigate(`/list/${createdList.id}`);
      } else {
        loadLists();
      }
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

  // Memoize sorted lists to avoid re-sorting on every render
  const sortedLists = useMemo(() => naturalSort(lists, (list) => list.title), [lists]);

  if (!folder) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Carregando pasta...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          
          <div className="flex items-center gap-3">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-2xl font-bold h-12"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                />
                <Button onClick={handleSaveTitle} disabled={isSavingTitle} size="sm">
                  {isSavingTitle ? "..." : "Salvar"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIsEditingTitle(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold">{folder.title}</h1>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditTitle(folder.title);
                      setIsEditingTitle(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
          {folder.description && (
            <p className="text-muted-foreground mt-2">{folder.description}</p>
          )}
        </div>

        <Tabs defaultValue="lists" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="lists">Listas</TabsTrigger>
            <TabsTrigger value="videos">Vídeos</TabsTrigger>
          </TabsList>

          <TabsContent value="lists">
            {isOwner && (
              <div className="mb-4 flex flex-wrap gap-2">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <ListPlus className="mr-1.5 h-4 w-4" />
                      Nova Lista
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh]">
                    <DialogHeader>
                      <DialogTitle>Criar Nova Lista</DialogTitle>
                      <DialogDescription>
                        A lista será criada e você será redirecionado automaticamente para editá-la.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateList}>
                      <ScrollArea className="max-h-[60vh] pr-4">
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
                          
                          {/* Study Type Selector */}
                          <ListStudyTypeSelector
                            value={newListStudySettings}
                            onChange={setNewListStudySettings}
                          />
                        </div>
                      </ScrollArea>
                      <DialogFooter className="mt-4">
                        <Button type="submit">Criar Lista</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm">
                      <Share2 className="mr-1.5 h-4 w-4" />
                      Compartilhar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Compartilhar Pasta</DialogTitle>
                      <DialogDescription>
                        Torne esta pasta e todo o seu conteúdo visível para seus alunos no Portal do Aluno.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <p className="text-sm text-muted-foreground">
                        A pasta será compartilhada com a turma. As listas e flashcards dentro dela também serão compartilhados.
                      </p>
                      <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg">
                        <Checkbox
                          id="allow-public"
                          checked={allowPublicPortal}
                          onCheckedChange={(c) => setAllowPublicPortal(Boolean(c))}
                        />
                        <div className="flex-1">
                          <Label htmlFor="allow-public" className="font-semibold cursor-pointer">
                            Permitir acesso sem login no Portal do Aluno
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            Os alunos poderão acessar o conteúdo em /portal sem precisar fazer login
                          </p>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleShareFolder} disabled={sharing}>
                        {sharing ? "Compartilhando..." : "Compartilhar"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {loading ? (
              <p className="text-center text-sm text-muted-foreground py-4">Carregando...</p>
            ) : lists.length === 0 ? (
              <Card className="text-center p-8">
                <CardHeader>
                  <CardTitle className="text-lg">Nenhuma lista ainda</CardTitle>
                  <CardDescription className="text-sm">
                    {isOwner
                      ? "Crie sua primeira lista de flashcards"
                      : "Esta pasta ainda não possui listas"}
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="space-y-2">
                {sortedLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => navigate(isOwner ? `/list/${list.id}` : `/portal/list/${list.id}/games`)}
                    className="w-full text-left"
                  >
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate leading-tight">
                            {list.title}
                          </h3>
                          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                            {list.card_count || 0} {list.card_count === 1 ? 'card' : 'cards'}
                          </p>
                        </div>

                        {/* Play Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 hover:bg-primary/10 hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/list/${list.id}/games`);
                          }}
                        >
                          <Play className="h-4 w-4" />
                        </Button>

                        {isOwner && (
                          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditList(list);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
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
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="videos">
            <VideoList folderId={id as string} isOwner={isOwner} />
          </TabsContent>
        </Tabs>

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
