import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeTabs } from "@/components/ape/ApeTabs";
import { ApeCardFolder } from "@/components/ape/ApeCardFolder";
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
import { FolderPlus, Trash2 } from "lucide-react";
import { useInstitution } from "@/contexts/InstitutionContext";

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
  const [teachers, setTeachers] = useState<TeacherType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newFolder, setNewFolder] = useState({ title: "", description: "", visibility: "private" });
  const [userRole, setUserRole] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { selectedInstitution } = useInstitution();

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
      <div className="flex items-center justify-between py-1">
        <h2 className="text-lg font-semibold">Minhas pastas</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="min-h-[40px]">
              <FolderPlus className="h-4 w-4 mr-2" />
              Nova pasta
            </Button>
          </DialogTrigger>
          <DialogContent>
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
          {folders.map((folder) => (
            <div key={folder.id} className="flex items-center gap-2">
              <div className="flex-1">
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
                className="h-12 w-12 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setFolderToDelete(folder.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
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

  const tabs = [
    { value: "folders", label: "Pastas", count: folders.length, content: foldersTab },
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
