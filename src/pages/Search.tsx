import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search as SearchIcon, FolderOpen, FileText, CreditCard, User, UserPlus, UserCheck, ArrowLeft, GraduationCap, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface Profile {
  id: string;
  first_name: string | null;
  email: string | null;
  public_slug: string | null;
  ape_id: string | null;
  user_type: string | null;
  is_teacher: boolean | null;
  folder_count?: number;
  isSubscribed?: boolean;
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
  const [searchType, setSearchType] = useState<'todos' | 'professor' | 'aluno'>('todos');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error("Digite um nome ou APE ID para buscar");
      return;
    }

    setSearching(true);
    setSelectedProfile(null);
    setFolders([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const clean = searchTerm.replace('@', '').trim().toUpperCase();

      // Buscar por nome, @slug público ou APE ID
      let query = supabase
        .from("profiles")
        .select("id, first_name, email, public_slug, ape_id, user_type, is_teacher")
        .or(`first_name.ilike.%${clean}%,public_slug.ilike.%${clean}%,ape_id.ilike.%${clean}%`)
        .limit(20);

      const { data, error } = await query;

      if (error) throw error;

      // Filtrar por tipo se necessário
      let filteredData = data || [];
      if (searchType === 'professor') {
        filteredData = filteredData.filter(p => p.is_teacher || p.user_type === 'professor');
      } else if (searchType === 'aluno') {
        filteredData = filteredData.filter(p => !p.is_teacher && p.user_type !== 'professor');
      }

      const profilesWithCounts = await Promise.all(
        filteredData.map(async (profile) => {
          const { count } = await supabase
            .from("folders")
            .select("*", { count: "exact", head: true })
            .eq("owner_id", profile.id)
            .eq("visibility", "class");

          const { data: subData } = await supabase
            .from("subscriptions")
            .select("id")
            .eq("teacher_id", profile.id)
            .eq("student_id", session.user.id)
            .maybeSingle();
          
          return { 
            ...profile, 
            folder_count: count || 0,
            isSubscribed: !!subData
          };
        })
      );

      setProfiles(profilesWithCounts);

      if (profilesWithCounts.length === 0) {
        toast.info("Nenhum usuário encontrado");
      }
    } catch (error: any) {
      console.error("Erro na busca:", error);
      toast.error("Erro ao buscar usuários");
    } finally {
      setSearching(false);
    }
  };

  const handleSubscription = async (teacherId: string, currentlySubscribed: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (currentlySubscribed) {
        const { error } = await supabase
          .from("subscriptions")
          .delete()
          .eq("teacher_id", teacherId)
          .eq("student_id", session.user.id);

        if (error) throw error;
        toast.success("Inscrição cancelada");
      } else {
        const { error } = await supabase
          .from("subscriptions")
          .insert({
            teacher_id: teacherId,
            student_id: session.user.id,
          });

        if (error) throw error;
        toast.success("Inscrito com sucesso!");
      }

      setProfiles(prev => prev.map(p => 
        p.id === teacherId ? { ...p, isSubscribed: !currentlySubscribed } : p
      ));
    } catch (error: any) {
      toast.error("Erro ao gerenciar inscrição: " + error.message);
    }
  };

  const loadFolders = async (profile: Profile) => {
    try {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("owner_id", profile.id)
        .eq("visibility", "class")
        .order("created_at", { ascending: false });

      if (error) throw error;

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
      setSelectedProfile(profile);
    } catch (error: any) {
      console.error("Erro ao carregar pastas:", error);
      toast.error("Erro ao carregar pastas");
    }
  };

  const isTeacher = (profile: Profile) => profile.is_teacher || profile.user_type === 'professor';

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="max-w-6xl mx-auto p-4 lg:px-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Buscar</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 lg:px-8">
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Nome ou APE ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={searching} className="w-full sm:w-auto">
                <SearchIcon className="mr-2 h-4 w-4" />
                {searching ? "Buscando..." : "Buscar"}
              </Button>
            </div>
            
            <Tabs value={searchType} onValueChange={(v: any) => setSearchType(v)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="professor">Professores</TabsTrigger>
                <TabsTrigger value="aluno">Alunos</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {profiles.length > 0 && !selectedProfile && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              Resultados ({profiles.length})
            </h2>
            <div className="grid gap-3">
              {profiles.map((profile) => (
                <Card
                  key={profile.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => isTeacher(profile) && profile.folder_count && profile.folder_count > 0 ? loadFolders(profile) : null}
                >
                  <CardHeader className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isTeacher(profile) ? 'bg-primary/10' : 'bg-secondary'}`}>
                          {isTeacher(profile) ? (
                            <GraduationCap className="h-5 w-5 text-primary" />
                          ) : (
                            <User className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">
                            {profile.first_name || "Sem nome"}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            <span className="font-mono">APE: {profile.ape_id || 'N/A'}</span>
                            {profile.public_slug && (
                              <span className="ml-2 text-primary">@{profile.public_slug}</span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={isTeacher(profile) ? "default" : "secondary"}>
                          {isTeacher(profile) ? 'Professor' : 'Aluno'}
                        </Badge>
                        {isTeacher(profile) && (profile.folder_count || 0) > 0 && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSubscription(profile.id, profile.isSubscribed || false);
                            }}
                            variant={profile.isSubscribed ? "outline" : "default"}
                            size="sm"
                          >
                            {profile.isSubscribed ? (
                              <><UserCheck className="mr-1 h-4 w-4" />Inscrito</>
                            ) : (
                              <><UserPlus className="mr-1 h-4 w-4" />Seguir</>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    {isTeacher(profile) && (profile.folder_count || 0) > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        <FolderOpen className="h-3 w-3 inline mr-1" />
                        {profile.folder_count} pasta{profile.folder_count !== 1 ? "s" : ""} compartilhada{profile.folder_count !== 1 ? "s" : ""}
                      </p>
                    )}
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}

        {selectedProfile && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Pastas de {selectedProfile.first_name}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedProfile(null);
                  setFolders([]);
                }}
              >
                Voltar à Busca
              </Button>
            </div>

            {folders.length === 0 ? (
              <Card className="p-8 text-center">
                <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Este professor ainda não compartilhou nenhuma pasta.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {folders.map((folder) => (
                  <Card
                    key={folder.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => navigate(`/folder/${folder.id}`)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1">{folder.title}</CardTitle>
                          {folder.description && (
                            <CardDescription className="text-sm">
                              {folder.description}
                            </CardDescription>
                          )}
                        </div>
                        <FolderOpen className="h-6 w-6 text-primary ml-2" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          <span>{folder.list_count || 0} listas</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
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
  );
}
