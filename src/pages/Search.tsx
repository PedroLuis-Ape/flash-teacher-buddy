import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search as SearchIcon, FolderOpen, FileText, CreditCard, User, UserPlus, UserCheck, ArrowLeft, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuthUser } from "@/hooks/useAuthUser";

interface Profile {
  id: string;
  first_name: string | null;
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
  const { userId, isLoading: authLoading } = useAuthUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [searchType, setSearchType] = useState<'todos' | 'professor' | 'aluno'>('todos');

  useEffect(() => {
    if (!authLoading && !userId) navigate("/auth", { replace: true });
  }, [authLoading, navigate, userId]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error("Digite um nome ou APE ID para buscar");
      return;
    }
    if (!userId) return;

    setSearching(true);
    setSelectedProfile(null);
    setFolders([]);

    try {
      const clean = searchTerm.replace('@', '').trim().toUpperCase();
      const { data, error } = await supabase.rpc("search_public_profiles", { _q: clean });
      if (error) throw error;

      let filteredData = (data || []) as Profile[];
      if (searchType === 'professor') {
        filteredData = filteredData.filter((profile) => profile.is_teacher || profile.user_type === 'professor');
      } else if (searchType === 'aluno') {
        filteredData = filteredData.filter((profile) => !profile.is_teacher && profile.user_type !== 'professor');
      }

      const profileIds = filteredData.map((profile) => profile.id);
      if (profileIds.length === 0) {
        setProfiles([]);
        toast.info("Nenhum usuário encontrado");
        return;
      }

      const [folderRows, subscriptionRows] = await Promise.all([
        supabase
          .from("folders")
          .select("owner_id")
          .in("owner_id", profileIds)
          .eq("visibility", "class")
          .is("deleted_at", null),
        supabase
          .from("subscriptions")
          .select("teacher_id")
          .eq("student_id", userId)
          .in("teacher_id", profileIds),
      ]);

      if (folderRows.error) throw folderRows.error;
      if (subscriptionRows.error) throw subscriptionRows.error;

      const folderCountMap = new Map<string, number>();
      for (const folder of folderRows.data || []) {
        folderCountMap.set(folder.owner_id, (folderCountMap.get(folder.owner_id) || 0) + 1);
      }
      const subscribedIds = new Set((subscriptionRows.data || []).map((row) => row.teacher_id));

      setProfiles(filteredData.map((profile) => ({
        ...profile,
        folder_count: folderCountMap.get(profile.id) || 0,
        isSubscribed: subscribedIds.has(profile.id),
      })));
    } catch (error) {
      console.error("Erro na busca:", error);
      toast.error("Erro ao buscar usuários");
    } finally {
      setSearching(false);
    }
  };

  const handleSubscription = async (teacherId: string, currentlySubscribed: boolean) => {
    if (!userId) return;

    try {
      const query = supabase
        .from("subscriptions")
        .delete()
        .eq("teacher_id", teacherId)
        .eq("student_id", userId);

      if (currentlySubscribed) {
        const { error } = await query;
        if (error) throw error;
        toast.success("Inscrição cancelada");
      } else {
        const { error } = await supabase.from("subscriptions").insert({
          teacher_id: teacherId,
          student_id: userId,
        });
        if (error) throw error;
        toast.success("Inscrito com sucesso!");
      }

      setProfiles((previous) => previous.map((profile) =>
        profile.id === teacherId ? { ...profile, isSubscribed: !currentlySubscribed } : profile
      ));
    } catch (error: any) {
      toast.error("Erro ao gerenciar inscrição: " + error.message);
    }
  };

  const loadFolders = async (profile: Profile) => {
    try {
      const { data: folderData, error: folderError } = await supabase
        .from("folders")
        .select("id, title, description, owner_id")
        .eq("owner_id", profile.id)
        .eq("visibility", "class")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (folderError) throw folderError;
      const safeFolders = (folderData || []) as Folder[];
      const folderIds = safeFolders.map((folder) => folder.id);

      if (folderIds.length === 0) {
        setFolders([]);
        setSelectedProfile(profile);
        return;
      }

      const { data: listData, error: listError } = await supabase
        .from("lists")
        .select("id, folder_id")
        .in("folder_id", folderIds)
        .is("deleted_at", null);
      if (listError) throw listError;

      const lists = listData || [];
      const listIds = lists.map((list) => list.id);
      const listFolderMap = new Map(lists.map((list) => [list.id, list.folder_id]));
      const listCountMap = new Map<string, number>();
      for (const list of lists) {
        if (!list.folder_id) continue;
        listCountMap.set(list.folder_id, (listCountMap.get(list.folder_id) || 0) + 1);
      }

      const cardCountMap = new Map<string, number>();
      if (listIds.length > 0) {
        const { data: cardData, error: cardError } = await supabase
          .from("flashcards")
          .select("list_id")
          .in("list_id", listIds);
        if (cardError) throw cardError;

        for (const card of cardData || []) {
          const folderId = listFolderMap.get(card.list_id);
          if (!folderId) continue;
          cardCountMap.set(folderId, (cardCountMap.get(folderId) || 0) + 1);
        }
      }

      setFolders(safeFolders.map((folder) => ({
        ...folder,
        list_count: listCountMap.get(folder.id) || 0,
        card_count: cardCountMap.get(folder.id) || 0,
      })));
      setSelectedProfile(profile);
    } catch (error) {
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
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
                className="flex-1"
              />
              <Button onClick={() => void handleSearch()} disabled={searching || authLoading} className="w-full sm:w-auto">
                <SearchIcon className="mr-2 h-4 w-4" />
                {searching ? "Buscando..." : "Buscar"}
              </Button>
            </div>

            <Tabs value={searchType} onValueChange={(value) => setSearchType(value as typeof searchType)}>
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
            <h2 className="text-lg font-semibold">Resultados ({profiles.length})</h2>
            <div className="grid gap-3">
              {profiles.map((profile) => (
                <Card
                  key={profile.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => isTeacher(profile) && (profile.folder_count || 0) > 0 ? void loadFolders(profile) : undefined}
                >
                  <CardHeader className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isTeacher(profile) ? 'bg-primary/10' : 'bg-secondary'}`}>
                          {isTeacher(profile)
                            ? <GraduationCap className="h-5 w-5 text-primary" />
                            : <User className="h-5 w-5 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{profile.first_name || "Sem nome"}</CardTitle>
                          <CardDescription className="text-xs">
                            <span className="font-mono">APE: {profile.ape_id || 'N/A'}</span>
                            {profile.public_slug && <span className="ml-2 text-primary">@{profile.public_slug}</span>}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={isTeacher(profile) ? "default" : "secondary"}>
                          {isTeacher(profile) ? 'Professor' : 'Aluno'}
                        </Badge>
                        {isTeacher(profile) && (profile.folder_count || 0) > 0 && (
                          <Button
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleSubscription(profile.id, profile.isSubscribed || false);
                            }}
                            variant={profile.isSubscribed ? "outline" : "default"}
                            size="sm"
                          >
                            {profile.isSubscribed
                              ? <><UserCheck className="mr-1 h-4 w-4" />Inscrito</>
                              : <><UserPlus className="mr-1 h-4 w-4" />Seguir</>}
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
              <h2 className="text-lg font-semibold">Pastas de {selectedProfile.first_name}</h2>
              <Button variant="outline" size="sm" onClick={() => { setSelectedProfile(null); setFolders([]); }}>
                Voltar à Busca
              </Button>
            </div>

            {folders.length === 0 ? (
              <Card className="p-8 text-center">
                <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Este professor ainda não compartilhou nenhuma pasta.</p>
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
                          {folder.description && <CardDescription className="text-sm">{folder.description}</CardDescription>}
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
