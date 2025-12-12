import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useHomeData } from "@/hooks/useHomeData";
import { useEconomy } from "@/contexts/EconomyContext";
import { useInstitution } from "@/contexts/InstitutionContext";
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
import { BookOpen, Play, TrendingUp, Users, Crown, Lock, Store, Search as SearchIcon, ChevronRight, GraduationCap, FolderPlus, Settings, Volume2, VolumeX } from "lucide-react";
import { useSoundSettings } from "@/hooks/useSoundSettings";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";

const Index = () => {
  const navigate = useNavigate();
  const { last, recents, stats, loading, refetch } = useHomeData();
  const { pts_weekly, level, current_streak } = useEconomy();
  const { selectedInstitution } = useInstitution();
  const { soundEnabled, toggleSound } = useSoundSettings();
  const [profileData, setProfileData] = useState<{
    firstName: string;
    avatarUrl: string | null;
  }>({ firstName: "", avatarUrl: null });

  useEffect(() => {
    checkAuth();
    loadProfileData();
  }, []);

  // Refetch when institution changes
  useEffect(() => {
    refetch();
  }, [selectedInstitution?.id, refetch]);

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
  const isHubEmpty = myLists.length === 0 && selectedInstitution;

  return (
    <div className="min-h-screen bg-background pb-24">
      <ApeAppBar title="Início" />

      <div className="max-w-6xl mx-auto space-y-6 px-4 lg:px-8 pt-4">
        {/* Profile Header */}
        <Card 
          className="overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 border-border"
          onClick={() => navigate("/profile")}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 shrink-0">
                <AvatarImage src={profileData.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold truncate">
                  Olá, {profileData.firstName || "Usuário"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Continue aprendendo!
                </p>
              </div>
              {/* Settings Popover */}
              <Popover>
                <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end" onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Configurações</h4>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {soundEnabled ? (
                          <Volume2 className="h-4 w-4 text-primary" />
                        ) : (
                          <VolumeX className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Label htmlFor="sound-toggle" className="text-sm">
                          Sons do jogo
                        </Label>
                      </div>
                      <Switch
                        id="sound-toggle"
                        checked={soundEnabled}
                        onCheckedChange={toggleSound}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 border-border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">PTS Semanais</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{pts_weekly}</p>
            )}
          </Card>

          <Card className="p-4 border-border">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Nível</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{level}</p>
            )}
          </Card>

          <Card className="p-4 border-border">
            <div className="flex items-center gap-2 mb-2">
              <Play className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Sequência</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{current_streak}</p>
            )}
          </Card>

          <Card className="p-4 border-border">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Listas</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{stats.total_lists}</p>
            )}
          </Card>
        </div>

        {/* Painel do Professor (apenas para professores) */}
        {FEATURE_FLAGS.meus_alunos_enabled && isTeacher && (
          <Card
            className="p-5 cursor-pointer hover:shadow-lg transition-all duration-200 border-border"
            onClick={() => navigate('/painel-professor')}
          >
            <div className="flex items-center gap-4">
              <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">Painel do Professor</h3>
                <p className="text-sm text-muted-foreground truncate">
                  Gerencie alunos, turmas e atribuições
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </div>
          </Card>
        )}

        {/* Turmas Card (apenas para alunos) */}
        {!isTeacher && <TurmasCard />}

        {/* NEW: Meus Professores Card (apenas para alunos) */}
        {!isTeacher && (
          <Card
            className="p-5 cursor-pointer hover:shadow-lg transition-all duration-200 border-border"
            onClick={() => navigate('/my-teachers')}
          >
            <div className="flex items-center gap-4">
              <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">Meus Professores</h3>
                <p className="text-sm text-muted-foreground truncate">
                  Veja os professores que você segue
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </div>
          </Card>
        )}

        {/* Continue Studying Card */}
        {last && (
          <Card className="overflow-hidden border-border">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Play className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">Voltar para onde parou</p>
                  <h3 className="font-semibold text-base mb-3 truncate">{last.title}</h3>
                  <div className="space-y-2">
                    <Progress value={pct} className="h-2" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {last.reviewed} de {last.total} cards
                      </span>
                      <span className="text-primary font-medium">{pct}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => navigate(`/list/${last.id}/games?mode=${last.mode || "flip"}`)}
                className="w-full mt-4 min-h-[44px]"
              >
                <Play className="h-4 w-4 mr-2" />
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Modo Reino Coming Soon */}
        <Card className="overflow-hidden border-2 border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-base truncate">Modo Reino</h3>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground truncate">
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
              className="min-h-[36px] px-3 text-primary hover:text-primary"
            >
              Ver todas
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : isHubEmpty ? (
            // Empty state for selected hub
            <Card className="p-8 text-center border-border">
              <FolderPlus className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-base mb-2">
                Nenhuma lista em "{selectedInstitution?.name}"
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Crie sua primeira lista neste hub ou mude para outro hub no menu lateral.
              </p>
              <Button 
                onClick={() => navigate("/folders")}
                className="min-h-[44px]"
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                Criar lista neste hub
              </Button>
            </Card>
          ) : myLists.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-2">Últimas estudadas</p>
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
            <Card className="p-8 text-center border-border">
              <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-base mb-2">Nenhuma lista encontrada</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Comece criando sua primeira lista de estudos
              </p>
              <Button 
                onClick={() => navigate("/folders")}
                className="min-h-[44px]"
              >
                Criar minha primeira lista
              </Button>
            </Card>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <ApeSectionTitle>Atalhos</ApeSectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Card
              className="p-5 cursor-pointer hover:shadow-lg transition-all duration-200 border-border"
              onClick={() => navigate("/store")}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Store className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Loja</h3>
                  <p className="text-sm text-muted-foreground">
                    Mascotes e avatares
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className="p-5 cursor-pointer hover:shadow-lg transition-all duration-200 border-border"
              onClick={() => navigate("/search")}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <SearchIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Buscar</h3>
                  <p className="text-sm text-muted-foreground">
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
