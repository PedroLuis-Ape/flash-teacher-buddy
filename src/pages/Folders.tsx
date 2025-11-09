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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FolderPlus, ShoppingBag } from "lucide-react";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

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

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

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

      // Load folders
      const { data: foldersData, error: foldersError } = await supabase
        .from("folders")
        .select(`
          id, 
          title, 
          description, 
          visibility, 
          owner_id,
          lists(id, flashcards(id))
        `)
        .eq("owner_id", session.user.id)
        .order("created_at", { ascending: false });

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
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select(`
          teacher_id,
          profiles:teacher_id (
            id,
            first_name,
            email
          )
        `)
        .eq("student_id", session.user.id);

      if (subscriptions) {
        const teachersList = subscriptions
          .filter((sub: any) => sub.profiles)
          .map((sub: any) => sub.profiles);
        
        setTeachers(teachersList);
      }

    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const createFolder = async () => {
    if (!newFolder.title.trim()) {
      toast.error("Digite um título para a pasta");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("folders")
        .insert({
          owner_id: session.user.id,
          title: newFolder.title,
          description: newFolder.description,
          visibility: newFolder.visibility
        });

      if (error) throw error;

      toast.success("Pasta criada com sucesso!");
      setDialogOpen(false);
      setNewFolder({ title: "", description: "", visibility: "private" });
      loadData();
    } catch (error: any) {
      console.error("Error creating folder:", error);
      toast.error("Erro ao criar pasta");
    }
  };

  // Tab: Overview (Visão Geral)
  const overviewTab = (
    <div className="p-4 space-y-6">
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl p-6">
        <h2 className="text-2xl font-bold mb-2">Bem-vindo! 👋</h2>
        <p className="text-muted-foreground">
          Organize suas pastas de estudo e acesse o conteúdo dos seus professores
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-primary">{folders.length}</div>
          <div className="text-sm text-muted-foreground">Pastas</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-primary">{teachers.length}</div>
          <div className="text-sm text-muted-foreground">Professores</div>
        </div>
      </div>
    </div>
  );

  // Tab: Folders (Pastas)
  const foldersTab = (
    <div className="p-4 space-y-4">
      <ApeSectionTitle
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <FolderPlus className="h-4 w-4 mr-2" />
                Nova Pasta
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
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={createFolder}>Criar Pasta</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        Minhas Pastas
      </ApeSectionTitle>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Carregando...
        </div>
      ) : folders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhuma pasta ainda</p>
          <p className="text-sm mt-2">Crie sua primeira pasta de estudos</p>
        </div>
      ) : (
        <ApeGrid>
          {folders.map((folder) => (
            <ApeCardFolder
              key={folder.id}
              title={folder.title}
              listCount={folder.list_count}
              cardCount={folder.card_count}
              onClick={() => navigate(`/folder/${folder.id}`)}
            />
          ))}
        </ApeGrid>
      )}
    </div>
  );

  // Tab: Teachers (Professores)
  const teachersTab = (
    <div className="p-4 space-y-4">
      <ApeSectionTitle
        action={
          <Button size="sm" variant="outline" onClick={() => navigate("/my-teachers")}>
            Gerenciar
          </Button>
        }
      >
        Meus Professores
      </ApeSectionTitle>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Carregando...
        </div>
      ) : teachers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Você ainda não segue nenhum professor</p>
          <Button 
            className="mt-4" 
            onClick={() => navigate("/my-teachers")}
          >
            Buscar Professores
          </Button>
        </div>
      ) : (
        <ApeGrid>
          {teachers.map((teacher) => (
            <ApeCardProfessor
              key={teacher.id}
              name={teacher.first_name || teacher.email}
              email={teacher.email}
              onClick={() => navigate(`/teacher/${teacher.id}/folders`)}
            />
          ))}
        </ApeGrid>
      )}
    </div>
  );

  // Tab: Store
  const storeTab = (
    <div className="p-4 space-y-4">
      <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl p-6 text-center">
        <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-yellow-600" />
        <h3 className="text-lg font-semibold mb-2">Loja do Piteco</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Colecione cartas e avatares exclusivos usando seus PiteCoins
        </p>
        <Button onClick={() => navigate("/store")}>
          Ir para a Loja
        </Button>
      </div>
    </div>
  );

  const tabs = [
    { value: "overview", label: "Visão Geral", content: overviewTab },
    { value: "folders", label: "Pastas", count: folders.length, content: foldersTab },
    { value: "teachers", label: "Professores", count: teachers.length, content: teachersTab },
  ];

  if (FEATURE_FLAGS.store_visible) {
    tabs.push({ value: "store", label: "Loja", content: storeTab });
  }

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Biblioteca" />
      <ApeTabs tabs={tabs} defaultValue="overview" />
    </div>
  );
};

export default Folders;
