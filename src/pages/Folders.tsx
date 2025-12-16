import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeTabs } from "@/components/ape/ApeTabs";
import { ApeCardFolder } from "@/components/ape/ApeCardFolder";
import { ApeCardList } from "@/components/ape/ApeCardList";
import { ApeCardProfessor } from "@/components/ape/ApeCardProfessor";
import { ApeGrid } from "@/components/ape/ApeGrid";
import { ApeSectionTitle } from "@/components/ape/ApeSectionTitle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FolderPlus, Trash2, Star, CheckSquare, Square, X } from "lucide-react";
import { useInstitution } from "@/contexts/InstitutionContext";
import { useFavorites, useToggleFavorite } from "@/hooks/useFavorites";

interface FolderType {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  list_count?: number;
  card_count?: number;
  isOwner?: boolean;
  owner_id?: string;
  teacher_name?: string;
}

interface ListType {
  id: string;
  title: string;
  description: string | null;
  folder_id: string;
  folder_title?: string;
  card_count?: number;
}

interface TeacherType {
  id: string;
  first_name: string;
  email: string;
  avatar_url?: string;
  folder_count?: number;
  list_count?: number;
  card_count?: number;
}

const Folders = () => {
  const navigate = useNavigate();
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [lists, setLists] = useState<ListType[]>([]);
  const [teachers, setTeachers] = useState<TeacherType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newFolder, setNewFolder] = useState({ title: "", description: "", visibility: "private" });
  const [userRole, setUserRole] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  
  // Bulk selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  
  const { selectedInstitution } = useInstitution();
  
  // Favorites
  const { data: folderFavorites = [] } = useFavorites(userId, 'folder');
  const { data: listFavorites = [] } = useFavorites(userId, 'list');
  const toggleFavorite = useToggleFavorite();

  useEffect(() => {
    checkAuth();
    loadData();
  }, [selectedInstitution]); // Reload when institution changes

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }
    
    setUserId(session.user.id);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (roleData) {
      setUserRole(roleData.role);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Build query with institution filter
      let foldersQuery = supabase
        .from("folders")
        .select(`
          id, 
          title, 
          description, 
          visibility, 
          owner_id,
          institution_id,
          lists(id, flashcards(id))
        `)
        .eq("owner_id", session.user.id)
        .is("class_id", null); // Only personal folders (not class folders)

      // Apply institution filter
      if (selectedInstitution) {
        foldersQuery = foldersQuery.eq("institution_id", selectedInstitution.id);
      } else {
        foldersQuery = foldersQuery.is("institution_id", null);
      }

      // Order by updated_at DESC (most recent first) for personal library
      foldersQuery = foldersQuery.order("updated_at", { ascending: false });

      const { data: foldersData, error: foldersError } = await foldersQuery;

      if (foldersError) throw foldersError;

      const processedFolders = (foldersData || []).map((folder: any) => ({
        ...folder,
        list_count: folder.lists?.length || 0,
        card_count: folder.lists?.reduce((sum: number, list: any) => 
          sum + (list.flashcards?.length || 0), 0) || 0,
        isOwner: true
      }));

      setFolders(processedFolders);

      // Load lists for favorites tab
      let listsQuery = supabase
        .from("lists")
        .select(`
          id,
          title,
          description,
          folder_id,
          folders!inner(title, owner_id, institution_id, class_id),
          flashcards(id)
        `)
        .eq("folders.owner_id", session.user.id)
        .is("folders.class_id", null);

      if (selectedInstitution) {
        listsQuery = listsQuery.eq("folders.institution_id", selectedInstitution.id);
      } else {
        listsQuery = listsQuery.is("folders.institution_id", null);
      }

      const { data: listsData, error: listsError } = await listsQuery;

      if (listsError) {
        console.error("Error loading lists:", listsError);
      } else {
        const processedLists = (listsData || []).map((list: any) => ({
          id: list.id,
          title: list.title,
          description: list.description,
          folder_id: list.folder_id,
          folder_title: list.folders?.title,
          card_count: list.flashcards?.length || 0,
        }));
        setLists(processedLists);
      }

      // Load teachers (subscriptions)
      const { data: subscriptions, error: subsError } = await supabase
        .from("subscriptions")
        .select("teacher_id")
        .eq("student_id", session.user.id);

      if (subsError) {
        console.error("Error loading subscriptions:", subsError);
      }

      if (subscriptions && subscriptions.length > 0) {
        // Get unique teacher IDs
        const teacherIds = Array.from(new Set(subscriptions.map(s => s.teacher_id)));
        
        // Fetch teacher profiles separately
        const { data: teacherProfiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, email")
          .in("id", teacherIds);

        if (profilesError) {
          console.error("Error loading teacher profiles:", profilesError);
        }

        if (teacherProfiles) {
          setTeachers(teacherProfiles as TeacherType[]);
        }
      }

    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const [isCreating, setIsCreating] = useState(false);

  const deleteFolder = async () => {
    if (!folderToDelete) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from("folders")
        .delete()
        .eq("id", folderToDelete);

      if (error) throw error;

      toast.success("✅ Pasta excluída com sucesso!");
      setFolderToDelete(null);
      loadData();
    } catch (error: any) {
      console.error("Error deleting folder:", error);
      toast.error("❌ Erro ao excluir pasta");
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle folder selection
  const toggleFolderSelection = (folderId: string) => {
    setSelectedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  // Bulk delete folders
  const bulkDeleteFolders = async () => {
    if (selectedFolders.size === 0) return;

    try {
      setIsDeleting(true);
      const idsToDelete = Array.from(selectedFolders);
      
      const { error } = await supabase
        .from("folders")
        .delete()
        .in("id", idsToDelete);

      if (error) throw error;

      toast.success(`✅ ${idsToDelete.length} pasta(s) excluída(s)!`);
      setSelectedFolders(new Set());
      setSelectMode(false);
      setShowBulkDeleteDialog(false);
      loadData();
    } catch (error: any) {
      console.error("Error deleting folders:", error);
      toast.error("❌ Erro ao excluir pastas");
    } finally {
      setIsDeleting(false);
    }
  };

  const createFolder = async () => {
    if (!newFolder.title.trim()) {
      toast.error("Digite um título para a pasta");
      return;
    }

    if (isCreating) return;

    try {
      setIsCreating(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("folders")
        .insert({
          owner_id: session.user.id,
          title: newFolder.title,
          description: newFolder.description,
          visibility: newFolder.visibility,
          institution_id: selectedInstitution?.id || null,
        });

      if (error) throw error;

      toast.success("✅ Pasta criada com sucesso!");
      setDialogOpen(false);
      setNewFolder({ title: "", description: "", visibility: "private" });
      loadData();
    } catch (error: any) {
      console.error("Error creating folder:", error);
      toast.error("❌ Erro ao criar pasta");
    } finally {
      setIsCreating(false);
    }
  };

  // Tab: Folders (Pastas)
  const foldersTab = (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 py-1">
        <h2 className="text-lg font-semibold">Minhas pastas</h2>
        <div className="flex items-center gap-2">
          {folders.length > 0 && (
            <Button 
              size="sm" 
              variant={selectMode ? "secondary" : "outline"}
              className="min-h-[40px]"
              onClick={() => {
                setSelectMode(!selectMode);
                if (selectMode) setSelectedFolders(new Set());
              }}
            >
              {selectMode ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Selecionar
                </>
              )}
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="min-h-[40px]">
                <FolderPlus className="h-4 w-4 mr-2" />
                Nova pasta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Pasta</DialogTitle>
                <DialogDescription>
                  Crie uma pasta para organizar suas listas de estudo
                </DialogDescription>
              </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={newFolder.title}
                  onChange={(e) => setNewFolder({ ...newFolder, title: e.target.value })}
                  placeholder="Ex: Inglês Básico"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  value={newFolder.description}
                  onChange={(e) => setNewFolder({ ...newFolder, description: e.target.value })}
                  placeholder="Descreva o conteúdo desta pasta..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setDialogOpen(false)}
                disabled={isCreating}
                className="min-h-[44px]"
              >
                Cancelar
              </Button>
              <Button 
                onClick={createFolder}
                disabled={isCreating}
                className="min-h-[44px]"
              >
                {isCreating ? 'Criando...' : 'Criar Pasta'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : folders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Nenhuma pasta ainda</p>
          <p className="text-xs mt-1">Crie sua primeira pasta de estudos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {folders.map((folder) => {
            const isFav = folderFavorites.includes(folder.id);
            const isSelected = selectedFolders.has(folder.id);
            return (
              <div key={folder.id} className="flex items-center gap-2">
                {selectMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    onClick={() => toggleFolderSelection(folder.id)}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>
                )}
                <div 
                  className={`flex-1 min-w-0 ${selectMode ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (selectMode) {
                      toggleFolderSelection(folder.id);
                    } else {
                      navigate(`/folder/${folder.id}`);
                    }
                  }}
                >
                  <ApeCardFolder
                    title={folder.title}
                    listCount={folder.list_count}
                    cardCount={folder.card_count}
                    onClick={selectMode ? undefined : () => navigate(`/folder/${folder.id}`)}
                  />
                </div>
                {!selectMode && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-11 w-11 shrink-0 rounded-xl ${isFav ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite.mutate({ resourceId: folder.id, resourceType: 'folder', isFavorite: isFav });
                      }}
                    >
                      <Star className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderToDelete(folder.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky bulk action bar for mobile */}
      {selectMode && selectedFolders.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t md:static md:mt-4 md:p-0 md:bg-transparent md:border-0">
          <Button 
            variant="destructive" 
            className="w-full min-h-[48px]"
            onClick={() => setShowBulkDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Apagar ({selectedFolders.size})
          </Button>
        </div>
      )}

      {/* Bulk delete confirmation dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedFolders.size} pasta(s)? Esta ação não pode ser desfeita.
              Todas as listas e flashcards dentro dessas pastas também serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={bulkDeleteFolders}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  // Tab: Teachers (Professores)
  const teachersTab = (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between py-1">
        <h2 className="text-lg font-semibold">Meus professores</h2>
        <Button size="sm" variant="outline" className="min-h-[40px]" onClick={() => navigate("/my-teachers")}>
          Gerenciar
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : teachers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Você ainda não segue nenhum professor</p>
          <Button 
            size="sm"
            variant="outline"
            className="mt-3 min-h-[40px]" 
            onClick={() => navigate("/my-teachers")}
          >
            Buscar Professores
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {teachers.map((teacher) => (
            <ApeCardProfessor
              key={teacher.id}
              name={teacher.first_name || teacher.email}
              email={teacher.email}
              folderCount={teacher.folder_count}
              listCount={teacher.list_count}
              cardCount={teacher.card_count}
              onClick={() => navigate(`/teacher/${teacher.id}/folders`)}
            />
          ))}
        </div>
      )}
    </div>
  );

  // Computed favorites
  const favoritedFolders = folders.filter(f => folderFavorites.includes(f.id));
  const favoritedLists = lists.filter(l => listFavorites.includes(l.id));
  const totalFavorites = favoritedFolders.length + favoritedLists.length;

  // Tab: Favorites (Favoritas)
  const favoritesTab = (
    <div className="p-4 space-y-6">
      {loading ? (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : totalFavorites === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum favorito ainda</p>
          <p className="text-xs mt-1">Toque na estrela em pastas ou listas para favoritar</p>
        </div>
      ) : (
        <>
          {/* Favorited Folders */}
          {favoritedFolders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Pastas favoritas
              </h3>
              <div className="space-y-2">
                {favoritedFolders.map((folder) => (
                  <div key={folder.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <ApeCardFolder
                        title={folder.title}
                        listCount={folder.list_count}
                        cardCount={folder.card_count}
                        onClick={() => navigate(`/folder/${folder.id}`)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-xl text-yellow-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite.mutate({ resourceId: folder.id, resourceType: 'folder', isFavorite: true });
                      }}
                    >
                      <Star className="h-4 w-4 fill-current" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Favorited Lists */}
          {favoritedLists.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Listas favoritas
              </h3>
              <div className="space-y-2">
                {favoritedLists.map((list) => (
                  <div key={list.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <ApeCardList
                        title={list.title}
                        subtitle={list.folder_title}
                        cardCount={list.card_count}
                        onClick={() => navigate(`/list/${list.id}`)}
                        onPlayClick={() => navigate(`/list/${list.id}/games`)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-xl text-yellow-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite.mutate({ resourceId: list.id, resourceType: 'list', isFavorite: true });
                      }}
                    >
                      <Star className="h-4 w-4 fill-current" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const tabs = [
    { value: "folders", label: "Pastas", count: folders.length, content: foldersTab },
    { value: "favorites", label: "Favoritas", count: totalFavorites, content: favoritesTab },
    { value: "teachers", label: "Professores", count: teachers.length, content: teachersTab },
  ];

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Biblioteca" />
      <ApeTabs tabs={tabs} defaultValue="folders" />
      
      <AlertDialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as listas e cards dentro desta pasta também serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteFolder}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Folders;
