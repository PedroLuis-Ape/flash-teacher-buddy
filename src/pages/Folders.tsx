import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PitecoLogo } from "@/components/PitecoLogo";
import { EconomyBadge } from "@/components/EconomyBadge";
import { toast } from "sonner";
import { FolderPlus, Folder, LogOut, FileText, CreditCard, Pencil, Search, Lock, Globe, Users, GraduationCap, ShoppingBag } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/ThemeToggle";
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

const Folders = () => {
  const navigate = useNavigate();
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [newFolder, setNewFolder] = useState({ title: "", description: "", visibility: "private" });
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    loadFolders();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, public_slug")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profile?.first_name) {
      setFirstName(profile.first_name);
    }
    if (profile?.public_slug) {
      setUsername(profile.public_slug);
    }

    // Buscar o role do usuário
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (roleData) {
      setUserRole(roleData.role);
    }
  };

  const loadFolders = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Buscar o role do usuário primeiro
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      let foldersData;

      if (roleData?.role === 'student') {
        // Alunos só veem pastas de professores que seguem
        const { data: subscriptions } = await supabase
          .from("subscriptions")
          .select("teacher_id")
          .eq("student_id", session.user.id);

        const teacherIds = subscriptions?.map(s => s.teacher_id) || [];

        if (teacherIds.length === 0) {
          // Se não segue ninguém, não mostra nenhuma pasta
          setFolders([]);
          setLoading(false);
          return;
        }

        // Buscar apenas pastas compartilhadas dos professores que segue
        const { data, error } = await supabase
          .from("folders")
          .select("*")
          .in("owner_id", teacherIds)
          .eq("visibility", "class")
          .order("created_at", { ascending: false });

        if (error) throw error;
        
        // Buscar nomes dos professores
        const { data: teacherProfiles } = await supabase
          .from("profiles")
          .select("id, first_name")
          .in("id", teacherIds);

        const teacherMap = new Map(teacherProfiles?.map(p => [p.id, p.first_name || "Professor"]) || []);
        
        foldersData = data?.map(folder => ({
          ...folder,
          teacher_name: teacherMap.get(folder.owner_id)
        }));
      } else {
        // Professores veem suas próprias pastas
        const { data, error } = await supabase
          .from("folders")
          .select("*")
          .eq("owner_id", session.user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        foldersData = data;
      }

      // Carregar contadores para cada pasta
      const foldersWithCounts = await Promise.all(
        (foldersData || []).map(async (folder) => {
          const isOwner = session.user.id === folder.owner_id;
          
          const { data: lists } = await supabase
            .from("lists")
            .select("id")
            .eq("folder_id", folder.id);

          const listIds = lists?.map(l => l.id) || [];
          
          let cardCount = 0;
          if (listIds.length > 0) {
            const { count } = await supabase
              .from("flashcards")
              .select("*", { count: "exact", head: true })
              .in("list_id", listIds);
            cardCount = count || 0;
          }

          return {
            ...folder,
            list_count: lists?.length || 0,
            card_count: cardCount,
            isOwner,
          };
        })
      );

      setFolders(foldersWithCounts);
    } catch (error: any) {
      toast.error("Erro ao carregar pastas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newFolder.title.trim()) {
      toast.error("O título é obrigatório");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: createdFolder, error } = await supabase
        .from("folders")
        .insert({
          title: newFolder.title,
          description: newFolder.description,
          owner_id: session.user.id,
          visibility: newFolder.visibility,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Pasta criada! Edite o conteúdo abaixo.");
      setDialogOpen(false);
      setNewFolder({ title: "", description: "", visibility: "private" });
      
      // Navegar automaticamente para a pasta criada
      if (createdFolder) {
        navigate(`/folder/${createdFolder.id}`);
      } else {
        loadFolders();
      }
    } catch (error: any) {
      toast.error("Erro ao criar pasta: " + error.message);
    }
  };

  const handleEditFolder = (folder: FolderType) => {
    setEditingFolder(folder);
    setEditDialogOpen(true);
  };

  const handleUpdateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingFolder || !editingFolder.title.trim()) {
      toast.error("O título é obrigatório");
      return;
    }

    try {
      const { error } = await supabase
        .from("folders")
        .update({
          title: editingFolder.title,
          description: editingFolder.description,
          visibility: editingFolder.visibility,
        })
        .eq("id", editingFolder.id);

      if (error) throw error;

      toast.success("Pasta atualizada com sucesso!");
      setEditDialogOpen(false);
      setEditingFolder(null);
      loadFolders();
    } catch (error: any) {
      toast.error("Erro ao atualizar pasta: " + error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (error: any) {
      toast.error("Erro ao sair: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8"> {/* PATCH: wrap no mobile */}
          <div className="flex items-center gap-4">
            <PitecoLogo className="w-16 h-16" />
            <div>
              <h1 className="text-3xl font-bold">Minhas Pastas</h1>
              {firstName && (
                <p className="text-muted-foreground">
                  Olá, {firstName}
                  {username && userRole === 'owner' && (
                    <span className="ml-2 text-primary font-medium">@{username}</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center"> {/* PATCH: wrap no mobile */}
            <ThemeToggle />
            {FEATURE_FLAGS.economy_enabled && <EconomyBadge />}
            {FEATURE_FLAGS.store_visible && (
              <Button onClick={() => navigate("/store")} variant="outline">
                <ShoppingBag className="mr-2 h-4 w-4" />
                Loja do Piteco
              </Button>
            )}
            <Button onClick={() => navigate("/profile")} variant="outline">
              Perfil
            </Button>
            {userRole === 'owner' && (
              <Button onClick={() => navigate("/my-students")} variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Meus Alunos
              </Button>
            )}
            {userRole === 'student' && (
              <Button onClick={() => navigate("/my-teachers")} variant="outline">
                <GraduationCap className="mr-2 h-4 w-4" />
                Meus Professores
              </Button>
            )}
            <Button onClick={() => navigate("/search")} variant="outline">
              <Search className="mr-2 h-4 w-4" />
              Buscar Professor
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem certeza que deseja sair?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você será desconectado da sua conta e redirecionado para a tela de login.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSignOut}>
                    Sim, sair
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="mb-6">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <FolderPlus className="mr-2 h-5 w-5" />
                Nova Pasta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Pasta</DialogTitle>
                <DialogDescription>
                  A pasta será criada e você será redirecionado automaticamente para editá-la.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateFolder}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título</Label>
                    <Input
                      id="title"
                      value={newFolder.title}
                      onChange={(e) => setNewFolder({ ...newFolder, title: e.target.value })}
                      placeholder="Ex: Inglês - Verbos"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição (opcional)</Label>
                    <Textarea
                      id="description"
                      value={newFolder.description}
                      onChange={(e) => setNewFolder({ ...newFolder, description: e.target.value })}
                      placeholder="Descreva o conteúdo desta pasta..."
                    />
                  </div>
                  {userRole === 'owner' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="visibility">Modo Compartilhado</Label>
                          <p className="text-sm text-muted-foreground">
                            Permite que alunos encontrem esta pasta
                          </p>
                        </div>
                        <Switch
                          id="visibility"
                          checked={newFolder.visibility === 'class'}
                          onCheckedChange={(checked) => 
                            setNewFolder({ ...newFolder, visibility: checked ? 'class' : 'private' })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit">Criar Pasta</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Carregando pastas...</p>
            </div>
          </div>
        ) : folders.length === 0 ? (
          <Card className="text-center p-12">
            <CardHeader>
              <CardTitle>Nenhuma pasta ainda</CardTitle>
              <CardDescription>
                {userRole === 'student' 
                  ? "Você ainda não está seguindo nenhum professor. Use o botão 'Buscar Professor' para encontrar professores."
                  : "Crie sua primeira pasta para organizar seus flashcards"
                }
              </CardDescription>
            </CardHeader>
          </Card>
        ) : userRole === 'student' ? (
          // Agrupar pastas por professor para alunos
          (() => {
            const foldersByTeacher = folders.reduce((acc, folder) => {
              const teacherId = folder.owner_id || 'unknown';
              if (!acc[teacherId]) {
                acc[teacherId] = {
                  teacherName: folder.teacher_name || 'Professor',
                  folders: []
                };
              }
              acc[teacherId].folders.push(folder);
              return acc;
            }, {} as Record<string, { teacherName: string; folders: FolderType[] }>);

            return (
              <div className="space-y-8">
                {Object.entries(foldersByTeacher).map(([teacherId, { teacherName, folders: teacherFolders }]) => (
                  <div key={teacherId}>
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <GraduationCap className="h-6 w-6 text-primary" />
                      Professor {teacherName}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {teacherFolders.map((folder) => (
                        <Card
                          key={folder.id}
                          className="cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => navigate(`/folder/${folder.id}`)}
                        >
                          <CardHeader>
                            <div className="flex items-center gap-2 mb-2">
                              <Folder className="h-8 w-8 text-primary" />
                              <Globe className="h-4 w-4 text-accent" />
                            </div>
                            <CardTitle>{folder.title}</CardTitle>
                            {folder.description && (
                              <CardDescription>{folder.description}</CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <FileText className="h-4 w-4" />
                                <span>{folder.list_count || 0} listas</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <CreditCard className="h-4 w-4" />
                                <span>{folder.card_count || 0} cards</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        ) : (
          // Professores veem lista normal
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {folders.map((folder) => (
              <Card
                key={folder.id}
                className="cursor-pointer hover:shadow-lg transition-shadow relative"
              >
                <div onClick={() => navigate(`/folder/${folder.id}`)}>
                  <CardHeader>
                  <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Folder className="h-8 w-8 text-primary" />
                        {folder.visibility === 'private' ? (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Globe className="h-4 w-4 text-accent" />
                        )}
                      </div>
                      {folder.isOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditFolder(folder);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <CardTitle className="mt-4">{folder.title}</CardTitle>
                  {folder.description && (
                    <CardDescription>{folder.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      <span>{folder.list_count || 0} listas</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CreditCard className="h-4 w-4" />
                      <span>{folder.card_count || 0} cards</span>
                    </div>
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
              <DialogTitle>Editar Pasta</DialogTitle>
              <DialogDescription>
                Altere o título e descrição da pasta
              </DialogDescription>
            </DialogHeader>
            {editingFolder && (
              <form onSubmit={handleUpdateFolder}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Título</Label>
                    <Input
                      id="edit-title"
                      value={editingFolder.title}
                      onChange={(e) => setEditingFolder({ ...editingFolder, title: e.target.value })}
                      placeholder="Ex: Inglês - Verbos"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Descrição (opcional)</Label>
                    <Textarea
                      id="edit-description"
                      value={editingFolder.description || ""}
                      onChange={(e) => setEditingFolder({ ...editingFolder, description: e.target.value })}
                      placeholder="Descreva o conteúdo desta pasta..."
                    />
                  </div>
                  {userRole === 'owner' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="edit-visibility">Modo Compartilhado</Label>
                          <p className="text-sm text-muted-foreground">
                            Permite que alunos encontrem esta pasta
                          </p>
                        </div>
                        <Switch
                          id="edit-visibility"
                          checked={editingFolder.visibility === 'class'}
                          onCheckedChange={(checked) => 
                            setEditingFolder({ ...editingFolder, visibility: checked ? 'class' : 'private' })
                          }
                        />
                      </div>
                    </div>
                  )}
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

export default Folders;
