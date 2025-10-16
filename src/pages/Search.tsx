import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search as SearchIcon, FolderOpen, FileText, CreditCard, User, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { PitecoMascot } from "@/components/PitecoMascot";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Profile {
  id: string;
  first_name: string | null;
  email: string | null;
  folder_count?: number;
}

interface Folder {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  list_count?: number;
  card_count?: number;
}

export default function Search() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Set<string>>(new Set());

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setCurrentUserId(session.user.id);
    loadSubscriptions(session.user.id);
  };

  const loadSubscriptions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("teacher_id")
        .eq("student_id", userId);

      if (error) throw error;
      
      const teacherIds = new Set(data?.map(s => s.teacher_id) || []);
      setSubscriptions(teacherIds);
    } catch (error: any) {
      console.error("Erro ao carregar inscrições:", error);
    }
  };

  const handleSubscribe = async (teacherId: string) => {
    if (!currentUserId) return;

    try {
      const { error } = await supabase
        .from("subscriptions")
        .insert({
          teacher_id: teacherId,
          student_id: currentUserId,
        });

      if (error) throw error;

      toast.success("Inscrito com sucesso!");
      loadSubscriptions(currentUserId);
    } catch (error: any) {
      toast.error("Erro ao se inscrever: " + error.message);
    }
  };

  const handleUnsubscribe = async (teacherId: string) => {
    if (!currentUserId) return;

    const confirmar = window.confirm("Tem certeza de que deseja cancelar a inscrição?");
    if (!confirmar) return;

    try {
      const { error } = await supabase
        .from("subscriptions")
        .delete()
        .eq("teacher_id", teacherId)
        .eq("student_id", currentUserId);

      if (error) throw error;

      toast.success("Inscrição cancelada!");
      loadSubscriptions(currentUserId);
    } catch (error: any) {
      toast.error("Erro ao cancelar inscrição: " + error.message);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error("Digite um nome para buscar");
      return;
    }

    setSearching(true);
    setSelectedProfile(null);
    setFolders([]);

    try {
      // Buscar professores/usuários pelo nome
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, email")
        .ilike("first_name", `%${searchTerm}%`)
        .limit(10);

      if (error) throw error;

      // Contar pastas compartilhadas de cada perfil
      const profilesWithCounts = await Promise.all(
        (data || []).map(async (profile) => {
          const { count } = await supabase
            .from("folders")
            .select("*", { count: "exact", head: true })
            .eq("owner_id", profile.id)
            .eq("visibility", "class");
          
          return { ...profile, folder_count: count || 0 };
        })
      );

      setProfiles(profilesWithCounts.filter(p => p.folder_count && p.folder_count > 0));

      if (profilesWithCounts.filter(p => p.folder_count && p.folder_count > 0).length === 0) {
        toast.info("Nenhum professor encontrado com esse nome");
      }
    } catch (error: any) {
      console.error("Erro na busca:", error);
      toast.error("Erro ao buscar professores");
    } finally {
      setSearching(false);
    }
  };

  const loadFolders = async (profileId: string, profileName: string) => {
    try {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("owner_id", profileId)
        .eq("visibility", "class")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Carregar contagens para cada pasta
      const foldersWithCounts = await Promise.all(
        (data || []).map(async (folder) => {
          const { count: listCount } = await supabase
            .from("lists")
            .select("*", { count: "exact", head: true })
            .eq("folder_id", folder.id);

          const { count: cardCount } = await supabase
            .from("flashcards")
            .select("*", { count: "exact", head: true })
            .in("list_id", 
              await supabase
                .from("lists")
                .select("id")
                .eq("folder_id", folder.id)
                .then(res => (res.data || []).map(l => l.id))
            );

          return {
            ...folder,
            list_count: listCount || 0,
            card_count: cardCount || 0,
          };
        })
      );

      setFolders(foldersWithCounts);
      setSelectedProfile({ id: profileId, first_name: profileName, email: null });
    } catch (error: any) {
      console.error("Erro ao carregar pastas:", error);
      toast.error("Erro ao carregar pastas");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-primary">
      <PitecoMascot />
      
      <div className="container mx-auto px-4 py-8 relative z-20">
        <div className="mb-8 flex items-center justify-between">
          <Button 
            variant="ghost" 
            className="text-primary-foreground hover:bg-white/20"
            onClick={() => navigate("/folders")}
          >
            Minhas Pastas
          </Button>
          <ThemeToggle />
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
              Buscar Professor
            </h1>
            <p className="text-xl text-primary-foreground/90">
              Digite o nome do professor para acessar suas pastas compartilhadas
            </p>
          </div>

          {/* Barra de busca */}
          <Card className="bg-white/95 backdrop-blur mb-8">
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o nome do professor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={searching}>
                  <SearchIcon className="mr-2 h-4 w-4" />
                  {searching ? "Buscando..." : "Buscar"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Resultados da busca - Professores */}
          {profiles.length > 0 && !selectedProfile && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-primary-foreground mb-4">
                Professores Encontrados
              </h2>
              <div className="grid gap-4">
                {profiles.map((profile) => (
                  <Card
                    key={profile.id}
                    className="bg-white/95 backdrop-blur hover:shadow-xl transition-shadow cursor-pointer"
                    onClick={() => loadFolders(profile.id, profile.first_name || "Professor")}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <User className="h-8 w-8 text-primary" />
                          <div>
                            <CardTitle className="text-xl">
                              {profile.first_name || "Professor"}
                            </CardTitle>
                            <CardDescription>
                              {profile.folder_count} pasta{profile.folder_count !== 1 ? "s" : ""} compartilhada{profile.folder_count !== 1 ? "s" : ""}
                            </CardDescription>
                          </div>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          {subscriptions.has(profile.id) ? (
                            <Button
                              variant="outline"
                              onClick={() => handleUnsubscribe(profile.id)}
                            >
                              <UserMinus className="mr-2 h-4 w-4" />
                              Cancelar Inscrição
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleSubscribe(profile.id)}
                            >
                              <UserPlus className="mr-2 h-4 w-4" />
                              Inscrever-se
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Pastas do professor selecionado */}
          {selectedProfile && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-primary-foreground">
                  Pastas de {selectedProfile.first_name}
                </h2>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedProfile(null);
                    setFolders([]);
                  }}
                  className="bg-white/20 text-primary-foreground border-white/40 hover:bg-white/30"
                >
                  Voltar à Busca
                </Button>
              </div>

              {folders.length === 0 ? (
                <Card className="bg-white/95 backdrop-blur">
                  <CardContent className="py-12 text-center">
                    <FolderOpen className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg text-muted-foreground">
                      Este professor ainda não compartilhou nenhuma pasta.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {folders.map((folder) => (
                    <Card
                      key={folder.id}
                      className="bg-white/95 backdrop-blur hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => navigate(`/folder/${folder.id}`)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-2xl mb-2">{folder.title}</CardTitle>
                            {folder.description && (
                              <CardDescription className="text-base">
                                {folder.description}
                              </CardDescription>
                            )}
                          </div>
                          <FolderOpen className="h-8 w-8 text-primary ml-4" />
                        </div>
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}