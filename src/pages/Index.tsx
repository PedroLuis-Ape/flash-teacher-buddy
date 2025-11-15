import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useHomeData } from "@/hooks/useHomeData";
import { useEconomy } from "@/contexts/EconomyContext";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeCardList } from "@/components/ape/ApeCardList";
import { ApeSectionTitle } from "@/components/ape/ApeSectionTitle";
import { TurmasCard } from "@/components/TurmasCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Play, TrendingUp, Users, Crown, Lock, Store, Search as SearchIcon, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const Index = () => {
  const navigate = useNavigate();
  const { last, recents, stats, loading } = useHomeData();
  const { pts_weekly, level, current_streak } = useEconomy();
  const [profileData, setProfileData] = useState<{
    firstName: string;
    avatarUrl: string | null;
  }>({ firstName: "", avatarUrl: null });

  useEffect(() => {
    checkAuth();
    loadProfileData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth", { replace: true });
    }
  };

  const loadProfileData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, avatar_url, avatar_skin_id")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        let avatarUrl = profile.avatar_url;
        
        if (!avatarUrl && profile.avatar_skin_id) {
          const { data: avatarData } = await supabase
            .from("public_catalog")
            .select("avatar_final")
            .eq("id", profile.avatar_skin_id)
            .single();
          
          if (avatarData?.avatar_final) {
            avatarUrl = avatarData.avatar_final;
          }
        }

        setProfileData({
          firstName: profile.first_name || "Usuário",
          avatarUrl: avatarUrl || null
        });
      }
    } catch (error) {
      console.error("[Index] Error loading profile:", error);
    }
  };

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('profiles')
        .select('is_teacher')
        .eq('id', user.id)
        .single();

      return data;
    },
  });

  const myLists = recents.slice(0, 5);

  const pct = last ? Math.round((last.reviewed / (last.total || 1)) * 100) : 0;

  const userInitials = profileData.firstName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isTeacher = profile?.is_teacher || false;

  return (
    <div className="min-h-screen bg-background pb-4">
      <ApeAppBar title="Início" />

      <div className="space-y-6 px-4 pt-4">
        {/* Profile Header */}
        <Card 
          className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate("/profile")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={profileData.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-lg font-bold">
                  Olá, {profileData.firstName || "Usuário"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Continue aprendendo!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">PTS Semanais</span>
            </div>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-2xl font-bold">{pts_weekly}</p>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Nível</span>
            </div>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-2xl font-bold">{level}</p>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Play className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Sequência</span>
            </div>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-2xl font-bold">{current_streak}</p>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Listas</span>
            </div>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-2xl font-bold">{stats.total_lists}</p>
            )}
          </Card>
        </div>

        {/* Painel do Professor (apenas para professores) */}
        {FEATURE_FLAGS.meus_alunos_enabled && isTeacher && (
          <Card
            className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/painel-professor')}
          >
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div className="flex-1">
                <h3 className="font-semibold text-base">Painel do Professor</h3>
                <p className="text-xs text-muted-foreground">
                  Gerencie alunos, turmas e atribuições
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>
        )}

        {/* Turmas Card (apenas para alunos) */}
        {!isTeacher && <TurmasCard />}

        {/* Continue Studying Card */}
        {last && (
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Play className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Voltar para onde parou</p>
                  <h3 className="font-semibold text-sm mb-2 truncate">{last.title}</h3>
                  <div className="space-y-2">
                    <Progress value={pct} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {last.reviewed} de {last.total} cards
                      </span>
                      <span className="text-primary font-medium">{pct}%</span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate(`/list/${last.id}/games?mode=${last.mode || "flip"}`)}
                  className="shrink-0"
                >
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modo Reino Coming Soon */}
        <Card className="overflow-hidden border-2 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm">Modo Reino</h3>
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Sistema de progressão gamificado • Em breve
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Minhas Listas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <ApeSectionTitle>Minhas listas</ApeSectionTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/folders")}
              className="h-8 px-2 text-primary hover:text-primary"
            >
              Ver todas
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : myLists.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Últimas estudadas</p>
              {myLists.map((list) => (
                <ApeCardList
                  key={list.id}
                  title={list.title}
                  cardCount={list.count}
                  badge={list.folder_name}
                  onClick={() => navigate(`/list/${list.id}/games`)}
                />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Nenhuma lista encontrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Comece criando sua primeira lista de estudos
              </p>
              <Button onClick={() => navigate("/folders")}>
                Criar minha primeira lista
              </Button>
            </Card>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <ApeSectionTitle>Atalhos</ApeSectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Card
              className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate("/store")}
            >
              <div className="flex flex-col items-center text-center gap-2">
                <Store className="h-6 w-6 text-primary" />
                <div>
                  <h3 className="font-semibold text-sm">Loja</h3>
                  <p className="text-xs text-muted-foreground">
                    Mascotes e avatares
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate("/search")}
            >
              <div className="flex flex-col items-center text-center gap-2">
                <SearchIcon className="h-6 w-6 text-primary" />
                <div>
                  <h3 className="font-semibold text-sm">Buscar</h3>
                  <p className="text-xs text-muted-foreground">
                    Encontre professores
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
