import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useHomeData } from "@/hooks/useHomeData";
import { useEconomy } from "@/contexts/EconomyContext";
import { useInstitution } from "@/contexts/InstitutionContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { pageMount, pageReady } from "@/lib/perfLog";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeCardList } from "@/components/ape/ApeCardList";
import { ApeCardFolder } from "@/components/ape/ApeCardFolder";
import { ApeSectionTitle } from "@/components/ape/ApeSectionTitle";
import { TurmasCard } from "@/features/classroom/components/TurmasCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Play, TrendingUp, Users, Crown, Lock, Store, Search as SearchIcon, ChevronRight, GraduationCap, Settings, Volume2, VolumeX, Bell, BellOff, FolderOpen } from "lucide-react";

import { TurmaShortcut } from "@/components/TurmaShortcut";
import { useSoundSettings } from "@/features/study/hooks/useSoundSettings";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";

const Index = () => {
  const navigate = useNavigate();
  const { last, recents, recentFolders, stats, loading, refetch } = useHomeData();
  const { pts_weekly, level, current_streak } = useEconomy();
  const { selectedInstitution } = useInstitution();
  const { soundEnabled, toggleSound, notificationsEnabled, toggleNotifications } = useSoundSettings();
  const { user, isLoading: authLoading } = useAuthUser();

  // DEV-only lifecycle markers — help locate where the app freezes.
  useEffect(() => {
    pageMount("Index");
  }, []);
  useEffect(() => {
    if (!loading && !authLoading) pageReady("Index", { recents: recents?.length });
  }, [loading, authLoading, recents?.length]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [authLoading, user, navigate]);

  // useHomeData already reloads when selectedInstitution changes (via loadData dep).
  // No redundant refetch needed.

  // Single consolidated profile query using cached auth
  const { data: profileData } = useQuery({
    queryKey: ['profile-home', user?.id],
    queryFn: async () => {
      if (!user) return { firstName: "Usuário", avatarUrl: null, isTeacher: false };

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, avatar_url, avatar_skin_id, is_teacher")
        .eq("id", user.id)
        .single();

      if (!profile) return { firstName: "Usuário", avatarUrl: null, isTeacher: false };

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

      return {
        firstName: profile.first_name || "Usuário",
        avatarUrl: avatarUrl || null,
        isTeacher: Boolean(profile.is_teacher),
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const safeRecents = Array.isArray(recents) ? recents.filter(Boolean) : [];
  const myLists = safeRecents.slice(0, 3);

  const safeRecentFolders = Array.isArray(recentFolders) ? recentFolders.filter(Boolean) : [];
  const myFolders = safeRecentFolders.slice(0, 3);

  const safeLast = last && typeof last === "object" ? last : null;
  const pct = safeLast ? Math.round((Number(safeLast.reviewed || 0) / (Number(safeLast.total || 0) || 1)) * 100) : 0;

  const safeFirstName = profileData?.firstName && typeof profileData.firstName === "string" && profileData.firstName.trim().length > 0
    ? profileData.firstName
    : "Usuário";

  const userInitials = safeFirstName
    .split(" ")
    .map((n) => n?.[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  const isTeacher = Boolean(profileData?.isTeacher);
  // (isHubEmpty removido — Home não exibe mais empty state grande de listas)
  const safeStats = {
    total_lists: Number(stats?.total_lists) || 0,
    total_cards: Number(stats?.total_cards) || 0,
    teachers_count: Number(stats?.teachers_count) || 0,
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/*
        Home AppBar (Linha 3 — título): mantém apenas o título e a busca.
        Economia, presente e tema são acessíveis pela top bar global / card de perfil
        para evitar duplicação visual no mobile.
      */}
      <ApeAppBar
        title="Início"
        showSearch
        showEconomy={false}
        showGift={false}
        showThemeToggle={false}
      />

      <div className="max-w-6xl mx-auto space-y-6 px-4 lg:px-8 pt-4">
        {/* Profile Header */}
        <Card 
          className="overflow-hidden cursor-pointer transition-all duration-200 border-border/60 bg-gradient-to-br from-card to-card/60 hover:shadow-[var(--shadow-hover)] hover:border-primary/30"
          onClick={() => navigate("/profile")}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 shrink-0 ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
                <AvatarImage src={profileData?.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold truncate">
                  Olá, {safeFirstName}
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
                    
                    {/* Sound Toggle */}
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

                    <Separator />

                    {/* Notifications Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {notificationsEnabled ? (
                          <Bell className="h-4 w-4 text-primary" />
                        ) : (
                          <BellOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Label htmlFor="notifications-toggle" className="text-sm">
                          Notificações
                        </Label>
                      </div>
                      <Switch
                        id="notifications-toggle"
                        checked={notificationsEnabled}
                        onCheckedChange={toggleNotifications}
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
          <Card className="p-4 border-border/60 bg-gradient-to-br from-card to-card/70 hover:shadow-[var(--shadow-card)] hover:border-primary/25 transition-all duration-200">
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

          <Card className="p-4 border-border/60 bg-gradient-to-br from-card to-card/70 hover:shadow-[var(--shadow-card)] hover:border-primary/25 transition-all duration-200">
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

          <Card className="p-4 border-border/60 bg-gradient-to-br from-card to-card/70 hover:shadow-[var(--shadow-card)] hover:border-primary/25 transition-all duration-200">
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

          <Card className="p-4 border-border/60 bg-gradient-to-br from-card to-card/70 hover:shadow-[var(--shadow-card)] hover:border-primary/25 transition-all duration-200">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Listas</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{safeStats.total_lists}</p>
            )}
          </Card>
        </div>

        {/* Turma Shortcut (for both students and teachers) */}
        <TurmaShortcut isTeacher={isTeacher} />

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
        {safeLast && (
          <Card className="overflow-hidden border-border">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Play className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">Voltar para onde parou</p>
                  <h3 className="font-semibold text-base mb-3 truncate">{safeLast.title || "Sem título"}</h3>
                  <div className="space-y-2">
                    <Progress value={pct} className="h-2" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {Number(safeLast.reviewed || 0)} de {Number(safeLast.total || 0)} cards
                      </span>
                      <span className="text-primary font-medium">{pct}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => navigate(`/list/${safeLast.id}/games?mode=${safeLast.mode || "flip"}`)}
                className="w-full mt-4 min-h-[44px]"
              >
                <Play className="h-4 w-4 mr-2" />
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Modo Reino Coming Soon */}
        <Card
          className="overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 relative"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-30 blur-3xl"
            style={{ background: "hsl(var(--primary-glow))" }}
          />
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shadow-[var(--shadow-glow)]">
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

        {/* Pastas recentes (filtradas por instituição/hub) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <ApeSectionTitle>
              {selectedInstitution
                ? `Pastas recentes — ${selectedInstitution.name}`
                : "Pastas recentes"}
            </ApeSectionTitle>
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
          ) : myFolders.length > 0 ? (
            <div className="space-y-3">
              {myFolders.map((folder) => (
                <ApeCardFolder
                  key={folder.id}
                  title={folder.title}
                  listCount={folder.list_count}
                  cardCount={folder.card_count}
                  onClick={() => navigate(`/folder/${folder.id}`)}
                />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center border-border">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {selectedInstitution
                  ? `Nenhuma pasta ainda em "${selectedInstitution.name}".`
                  : "Nenhuma pasta na área Geral."}
              </p>
            </Card>
          )}
        </div>

        {/* Listas recentes — só aparece quando há listas */}
        {loading ? (
          <div className="space-y-4">
            <ApeSectionTitle>Listas recentes</ApeSectionTitle>
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          </div>
        ) : myLists.filter((list) => typeof (list as any)?.id === "string").length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <ApeSectionTitle>Listas recentes</ApeSectionTitle>
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
            <div className="space-y-3">
              {myLists
                .filter((list) => typeof (list as any)?.id === "string")
                .map((list) => (
                  <ApeCardList
                    key={list.id}
                    title={list.title || "Sem título"}
                    cardCount={Number(list.count) || 0}
                    badge={list.folder_name || "Sem pasta"}
                    onClick={() => navigate(`/list/${list.id}`)}
                    onPlayClick={() => navigate(`/list/${list.id}/games`)}
                  />
                ))}
            </div>
          </div>
        ) : null}

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
