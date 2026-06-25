import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, FileText, FolderOpen, GraduationCap, School, Search as SearchIcon, User, UserCheck, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

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
  list_count: number;
  card_count: number;
}

interface PublicTurma {
  id: string;
  nome: string;
  descricao: string | null;
}

const isTeacher = (profile: Profile) => Boolean(profile.is_teacher || profile.user_type === "professor");

export default function SearchFixed() {
  const navigate = useNavigate();
  const { userId, isLoading: authLoading } = useAuthUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<"todos" | "professor" | "aluno">("todos");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [turmas, setTurmas] = useState<PublicTurma[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!authLoading && !userId) navigate("/auth", { replace: true });
  }, [authLoading, navigate, userId]);

  const handleSearch = async () => {
    if (!searchTerm.trim() || !userId) {
      if (!searchTerm.trim()) toast.error("Digite um nome ou APE ID para buscar");
      return;
    }

    setSearching(true);
    setSelectedProfile(null);
    setFolders([]);
    setTurmas([]);

    try {
      const clean = searchTerm.replace("@", "").trim().toUpperCase();
      const { data, error } = await supabase.rpc("search_public_profiles", { _q: clean });
      if (error) throw error;

      let found = (data || []) as Profile[];
      if (searchType === "professor") found = found.filter(isTeacher);
      if (searchType === "aluno") found = found.filter((profile) => !isTeacher(profile));

      if (found.length === 0) {
        setProfiles([]);
        toast.info("Nenhum usuário encontrado");
        return;
      }

      const ids = found.map((profile) => profile.id);
      const [folderRows, subscriptionRows] = await Promise.all([
        supabase.from("folders").select("owner_id").in("owner_id", ids).eq("visibility", "class").is("deleted_at", null),
        supabase.from("subscriptions").select("teacher_id").eq("student_id", userId).in("teacher_id", ids),
      ]);
      if (folderRows.error) throw folderRows.error;
      if (subscriptionRows.error) throw subscriptionRows.error;

      const counts = new Map<string, number>();
      for (const folder of folderRows.data || []) counts.set(folder.owner_id, (counts.get(folder.owner_id) || 0) + 1);
      const subscribed = new Set((subscriptionRows.data || []).map((row) => row.teacher_id));

      setProfiles(found.map((profile) => ({
        ...profile,
        folder_count: counts.get(profile.id) || 0,
        isSubscribed: subscribed.has(profile.id),
      })));
    } catch (error) {
      console.error("Erro na busca:", error);
      toast.error("Erro ao buscar usuários");
    } finally {
      setSearching(false);
    }
  };

  const handleSubscription = async (profile: Profile) => {
    if (!userId || profile.id === userId) return;

    try {
      if (profile.isSubscribed) {
        const { error } = await supabase.from("subscriptions").delete().eq("student_id", userId).eq("teacher_id", profile.id);
        if (error) throw error;
        toast.success("Inscrição cancelada");
      } else {
        const { error } = await supabase.from("subscriptions").insert({ student_id: userId, teacher_id: profile.id });
        if (error) throw error;
        toast.success("Professor seguido com sucesso!");
      }

      const nextValue = !profile.isSubscribed;
      setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, isSubscribed: nextValue } : item));
      setSelectedProfile((current) => current?.id === profile.id ? { ...current, isSubscribed: nextValue } : current);
    } catch (error: any) {
      toast.error(`Erro ao gerenciar inscrição: ${error.message}`);
    }
  };

  const openProfile = async (profile: Profile) => {
    setSelectedProfile(profile);
    setFolders([]);
    setTurmas([]);
    if (!isTeacher(profile)) return;

    setLoadingDetails(true);
    try {
      const [folderResult, turmaResult] = await Promise.all([
        supabase.from("folders").select("id, title, description").eq("owner_id", profile.id).eq("visibility", "class").is("class_id", null).is("deleted_at", null).order("created_at", { ascending: false }),
        profile.public_slug
          ? (supabase.rpc as any)("get_public_teacher_turmas", { _slug: profile.public_slug })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (folderResult.error) throw folderResult.error;
      if (turmaResult.error) throw turmaResult.error;

      const rawFolders = folderResult.data || [];
      const folderIds = rawFolders.map((folder) => folder.id);
      const countMap = new Map<string, { lists: number; cards: number }>();

      if (folderIds.length > 0) {
        const { data: listRows, error: listError } = await supabase
          .from("lists")
          .select("id, folder_id, flashcards(count)")
          .in("folder_id", folderIds)
          .eq("visibility", "class")
          .is("deleted_at", null);
        if (listError) throw listError;

        for (const list of listRows || []) {
          if (!list.folder_id) continue;
          const current = countMap.get(list.folder_id) || { lists: 0, cards: 0 };
          const countRow = Array.isArray(list.flashcards) ? list.flashcards[0] : list.flashcards;
          countMap.set(list.folder_id, { lists: current.lists + 1, cards: current.cards + Number(countRow?.count || 0) });
        }
      }

      setFolders(rawFolders.map((folder) => ({
        ...folder,
        list_count: countMap.get(folder.id)?.lists || 0,
        card_count: countMap.get(folder.id)?.cards || 0,
      })));
      setTurmas((turmaResult.data || []) as PublicTurma[]);
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      toast.error("Erro ao carregar informações do perfil");
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center gap-4 p-4 lg:px-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-2xl font-bold">Buscar</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-4 lg:px-8">
        <Card><CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input placeholder="Nome ou APE ID..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void handleSearch()} />
            <Button onClick={() => void handleSearch()} disabled={searching || authLoading}><SearchIcon className="mr-2 h-4 w-4" />{searching ? "Buscando..." : "Buscar"}</Button>
          </div>
          <Tabs value={searchType} onValueChange={(value) => setSearchType(value as typeof searchType)}>
            <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="todos">Todos</TabsTrigger><TabsTrigger value="professor">Professores</TabsTrigger><TabsTrigger value="aluno">Alunos</TabsTrigger></TabsList>
          </Tabs>
        </CardContent></Card>

        {!selectedProfile && profiles.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Resultados ({profiles.length})</h2>
            {profiles.map((profile) => (
              <Card key={profile.id} className="cursor-pointer transition hover:shadow-md" onClick={() => void openProfile(profile)}>
                <CardHeader className="py-4"><div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">{isTeacher(profile) ? <GraduationCap className="h-5 w-5 text-primary" /> : <User className="h-5 w-5" />}</span>
                    <div className="min-w-0"><CardTitle className="truncate text-base">{profile.first_name || "Sem nome"}</CardTitle><CardDescription className="font-mono">APE: {profile.ape_id || "N/A"}</CardDescription></div>
                  </div>
                  <div className="flex items-center gap-2"><Badge variant={isTeacher(profile) ? "default" : "secondary"}>{isTeacher(profile) ? "Professor" : "Aluno"}</Badge>
                    {isTeacher(profile) && profile.id !== userId && <Button size="sm" variant={profile.isSubscribed ? "outline" : "default"} onClick={(event) => { event.stopPropagation(); void handleSubscription(profile); }}>{profile.isSubscribed ? <><UserCheck className="mr-1 h-4 w-4" />Seguindo</> : <><UserPlus className="mr-1 h-4 w-4" />Seguir</>}</Button>}
                  </div>
                </div></CardHeader>
              </Card>
            ))}
          </section>
        )}

        {selectedProfile && (
          <section className="space-y-5">
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Perfil</h2><Button variant="outline" size="sm" onClick={() => setSelectedProfile(null)}>Voltar à busca</Button></div>
            <Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div><div className="flex items-center gap-2"><h3 className="text-xl font-bold">{selectedProfile.first_name || "Sem nome"}</h3><Badge>{isTeacher(selectedProfile) ? "Professor" : "Aluno"}</Badge></div><p className="mt-2 font-mono text-sm">APE: {selectedProfile.ape_id || "N/A"}</p>{selectedProfile.public_slug && <p className="text-sm text-primary">@{selectedProfile.public_slug}</p>}</div>
              {isTeacher(selectedProfile) && selectedProfile.id !== userId && <Button variant={selectedProfile.isSubscribed ? "outline" : "default"} onClick={() => void handleSubscription(selectedProfile)}>{selectedProfile.isSubscribed ? "Deixar de seguir" : "Seguir professor"}</Button>}
            </CardContent></Card>

            {isTeacher(selectedProfile) && loadingDetails && <Card className="p-8 text-center text-muted-foreground">Carregando materiais...</Card>}
            {isTeacher(selectedProfile) && !loadingDetails && turmas.length > 0 && <div className="space-y-3"><h3 className="font-semibold">Turmas públicas</h3><div className="grid gap-3 md:grid-cols-2">{turmas.map((turma) => <Card key={turma.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold">{turma.nome}</h4>{turma.descricao && <p className="mt-1 text-sm text-muted-foreground">{turma.descricao}</p>}</div><School className="h-5 w-5 text-primary" /></div><Button className="mt-4 w-full" onClick={() => navigate(`/turmas/${turma.id}`)}>Abrir turma</Button></Card>)}</div></div>}
            {isTeacher(selectedProfile) && !loadingDetails && <div className="space-y-3"><h3 className="font-semibold">Pastas compartilhadas</h3>{folders.length === 0 ? <Card className="p-8 text-center text-muted-foreground">Este professor ainda não compartilhou nenhuma pasta.</Card> : <div className="grid gap-3 md:grid-cols-2">{folders.map((folder) => <Card key={folder.id} className="cursor-pointer transition hover:shadow-md" onClick={() => navigate(`/folder/${folder.id}`)}><CardHeader><CardTitle className="text-lg">{folder.title}</CardTitle>{folder.description && <CardDescription>{folder.description}</CardDescription>}</CardHeader><CardContent className="flex gap-4 text-xs text-muted-foreground"><span><FileText className="mr-1 inline h-3 w-3" />{folder.list_count} listas</span><span><CreditCard className="mr-1 inline h-3 w-3" />{folder.card_count} cards</span><FolderOpen className="ml-auto h-4 w-4 text-primary" /></CardContent></Card>)}</div>}</div>}
          </section>
        )}
      </main>
    </div>
  );
}
