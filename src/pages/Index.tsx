import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useHomeData } from "@/hooks/useHomeData";
import { useLatestStudyResume } from "@/hooks/useLatestStudyResume";
import { buildStudyResumeRoute } from "@/features/study/lib/studyResumeRoute";
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
import { BookOpen, Play, TrendingUp, Users, Crown, Coins, Lock, Store, Search as SearchIcon, ChevronRight, GraduationCap, Settings, Volume2, VolumeX, Bell, BellOff, Library, Target, StickyNote, Plus } from "lucide-react";

import { TurmaShortcut } from "@/components/TurmaShortcut";
import { useSoundSettings } from "@/features/study/hooks/useSoundSettings";
import { PaletteSelector } from "@/components/PaletteSelector";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { recents, recentFolders, stats, loading, refetch } = useHomeData();
  // Fonte única de retomada (ponteiro local + fallback remoto). A Home não
  // reconstrói mais a sessão a partir de list_id/mode/current_index.
  const { resume } = useLatestStudyResume();
  const [isOpeningResume, setIsOpeningResume] = useState(false);
  const { pts_weekly, balance_pitecoin, level, current_streak } = useEconomy();
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
      if (!user) return { firstName: t("common.user"), avatarUrl: null, isTeacher: false };

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, avatar_url, avatar_skin_id, is_teacher")
        .eq("id", user.id)
        .single();

      if (!profile) return { firstName: t("common.user"), avatarUrl: null, isTeacher: false };

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
        firstName: profile.first_name || t("common.user"),
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

  const safeLast = resume;
  const pct = safeLast && safeLast.totalCards > 0
    ? Math.min(100, Math.round((safeLast.progressCount / safeLast.totalCards) * 100))
    : 0;
  const resumeRoute = useMemo(
    () => (safeLast ? buildStudyResumeRoute({ path: safeLast.path, sessionId: safeLast.sessionId }) : null),
    [safeLast],
  );
  // Toque duplo não pode criar duas navegações nem duas sessões.
  const handleContinueStudy = useCallback(() => {
    if (isOpeningResume || !resumeRoute) return;
    setIsOpeningResume(true);
    navigate(resumeRoute);
  }, [isOpeningResume, navigate, resumeRoute]);

  const safeFirstName = profileData?.firstName && typeof profileData.firstName === "string" && profileData.firstName.trim().length > 0
    ? profileData.firstName
    : t("common.user");

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
        title={t("home.title")}
        variant="home"
        showSearch
      />

      <div className="max-w-[1600px] mx-auto space-y-6 px-4 lg:px-8 xl:px-12 pt-4">
        {/* Profile Header — premium welcome banner */}
        <Card
          className="welcome-banner cursor-pointer border-0"
          onClick={() => navigate("/profile")}
        >
          <CardContent className="relative p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 ring-2 ring-primary/50 ring-offset-2 ring-offset-background shadow-[0_0_24px_-6px_hsl(var(--primary)/0.7)]">
                <AvatarImage src={profileData?.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold truncate">
                  {t("home.greeting", { name: safeFirstName })}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("home.keepLearning")}
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
                    <h4 className="font-medium text-sm">{t("home.settings")}</h4>
                    
                    {/* Sound Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {soundEnabled ? (
                          <Volume2 className="h-4 w-4 text-primary" />
                        ) : (
                          <VolumeX className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Label htmlFor="sound-toggle" className="text-sm">
                          {t("home.gameSounds")}
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
                          {t("home.notifications")}
                        </Label>
                      </div>
                      <Switch
                        id="notifications-toggle"
                        checked={notificationsEnabled}
                        onCheckedChange={toggleNotifications}
                      />
                    </div>

                    <Separator />

                    {/* Palette Selector */}
                    <PaletteSelector />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards — premium stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 xl:gap-4">
          <Card className="stat-tile p-4 border-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="icon-tile !w-9 !h-9"><TrendingUp className="h-4 w-4 text-primary" /></span>
              <span className="text-xs text-muted-foreground">{t("home.stats.weeklyPts")}</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold tracking-tight">{pts_weekly}</p>
            )}
          </Card>

          <Card
            className="stat-tile cursor-pointer p-4 border-0"
            onClick={() => navigate('/store')}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="icon-tile !h-9 !w-9"><Coins className="h-4 w-4 text-primary" /></span>
              <span className="text-xs text-muted-foreground">{t("home.stats.pitecoin")}</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold tracking-tight">₱{balance_pitecoin}</p>
            )}
          </Card>

          <Card className="stat-tile p-4 border-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="icon-tile !w-9 !h-9"><Crown className="h-4 w-4 text-primary" /></span>
              <span className="text-xs text-muted-foreground">{t("home.stats.level")}</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold tracking-tight">{level}</p>
            )}
          </Card>

          <Card className="stat-tile p-4 border-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="icon-tile !w-9 !h-9"><Play className="h-4 w-4 text-primary" /></span>
              <span className="text-xs text-muted-foreground">{t("home.stats.streak")}</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold tracking-tight">{current_streak}</p>
            )}
          </Card>

          <Card className="stat-tile p-4 border-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="icon-tile !w-9 !h-9"><BookOpen className="h-4 w-4 text-primary" /></span>
              <span className="text-xs text-muted-foreground">{t("home.stats.lists")}</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold tracking-tight">{safeStats.total_lists}</p>
            )}
          </Card>
        </div>

        {/* Turma Shortcut (for both students and teachers) */}
        <TurmaShortcut isTeacher={isTeacher} />

        {/*
          Feature cards grid — empilhado no mobile, 2 colunas em desktop
          para aproveitar melhor a largura sem mexer na lógica de cada card.
        */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 xl:gap-4">
        {FEATURE_FLAGS.meus_alunos_enabled && isTeacher && (
          <Card
            className="p-5 cursor-pointer hover:shadow-lg transition-all duration-200 border-border h-full"
            onClick={() => navigate('/painel-professor')}
          >
            <div className="flex items-center gap-4">
              <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">{t("home.teacherPanel.title")}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {t("home.teacherPanel.description")}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </div>
          </Card>
        )}


        {/* NEW: Meus Professores Card (apenas para alunos) */}
        {!isTeacher && (
          <Card
            className="p-5 cursor-pointer hover:shadow-lg transition-all duration-200 border-border h-full"
            onClick={() => navigate('/my-teachers')}
          >
            <div className="flex items-center gap-4">
              <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">{t("home.myTeachers.title")}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {t("home.myTeachers.description")}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </div>
          </Card>
        )}

        {/* Continue Studying Card */}
        {safeLast && (
          <Card className="overflow-hidden border-border h-full">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Play className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">{t("home.resume.label")}</p>
                  <h3 className="font-semibold text-base mb-3 truncate">{safeLast.title || t("home.untitled")}</h3>
                  <div className="space-y-2">
                    <Progress value={pct} className="h-2" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("home.resume.progress", {
                          done: safeLast.progressCount,
                          total: safeLast.totalCards,
                          unit: safeLast.progressUnit,
                        })}
                      </span>
                      <span className="text-primary font-medium">{pct}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleContinueStudy}
                disabled={isOpeningResume || !resumeRoute}
                className="w-full mt-4 min-h-[44px]"
              >
                <Play className="h-4 w-4 mr-2" />
                {isOpeningResume ? t("home.resume.opening") : t("home.resume.continue")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Fallback primary CTA quando ainda não há histórico de estudo */}
        {!safeLast && !loading && (
          <Card className="overflow-hidden border-border h-full">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Library className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">{t("home.start.ready")}</p>
                  <h3 className="font-semibold text-base mb-3">
                    {safeRecents.length > 0 || myFolders.length > 0
                      ? t("home.start.openLibrary")
                      : t("home.start.createFirst")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {safeRecents.length > 0 || myFolders.length > 0
                      ? t("home.start.openLibraryDescription")
                      : t("home.start.createFirstDescription")}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/folders")}
                className="w-full mt-4 min-h-[44px]"
              >
                <Play className="h-4 w-4 mr-2" />
                {safeRecents.length > 0 || myFolders.length > 0
                  ? t("home.start.ctaOpenLibrary")
                  : t("home.start.ctaCreateList")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Modo Reino Coming Soon */}
        <Card
          className="overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 relative h-full"
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
                  <h3 className="font-semibold text-base truncate">{t("home.kingdom.title")}</h3>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {t("home.kingdom.description")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Pastas recentes (filtradas por instituição/hub) */}
        {(loading || myFolders.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <ApeSectionTitle>
              {selectedInstitution
                ? t("home.recentFoldersScoped", { name: selectedInstitution.name })
                : t("home.recentFolders")}
            </ApeSectionTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/folders")}
              className="min-h-[36px] px-3 text-primary hover:text-primary"
            >
              {t("home.viewAll")}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-fr">
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
          ) : null}
        </div>
        )}

        {/* Listas recentes — só aparece quando há listas */}
        {loading ? (
          <div className="space-y-4">
            <ApeSectionTitle>{t("home.recentListsSection")}</ApeSectionTitle>
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          </div>
        ) : myLists.filter((list) => typeof (list as any)?.id === "string").length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <ApeSectionTitle>{t("home.recentListsSection")}</ApeSectionTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/folders")}
                className="min-h-[36px] px-3 text-primary hover:text-primary"
              >
                {t("home.viewAll")}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-fr">
              {myLists
                .filter((list) => typeof (list as any)?.id === "string")
                .map((list) => (
                  <ApeCardList
                    key={list.id}
                    title={list.title || t("home.untitled")}
                    cardCount={Number(list.count) || 0}
                    badge={list.folder_name || t("home.noFolder")}
                    onClick={() => navigate(`/list/${list.id}`)}
                    onPlayClick={() => navigate(`/list/${list.id}/games`)}
                  />
                ))}
            </div>
          </div>
        ) : null}

        {/* Quick Actions */}
        <div className="space-y-4">
          <ApeSectionTitle>{t("home.shortcuts")}</ApeSectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <Card
              className="p-5 cursor-pointer hover:shadow-lg transition-all duration-200 border-border"
              onClick={() => navigate("/folders")}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Library className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">{t("home.quick.library")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("home.quick.libraryDescription")}
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className="p-5 cursor-pointer hover:shadow-lg transition-all duration-200 border-border"
              onClick={() => navigate("/folders?action=new-list")}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">{t("home.quick.newList")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("home.quick.newListDescription")}
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className="p-5 cursor-pointer hover:shadow-lg transition-all duration-200 border-border"
              onClick={() => navigate("/goals")}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">{t("home.quick.goals")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("home.quick.goalsDescription")}
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className="p-5 cursor-pointer hover:shadow-lg transition-all duration-200 border-border"
              onClick={() => navigate("/notes")}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <StickyNote className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">{t("home.quick.notes")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("home.quick.notesDescription")}
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className="p-5 cursor-pointer hover:shadow-lg transition-all duration-200 border-border"
              onClick={() => navigate("/store")}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Store className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">{t("home.quick.store")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("home.quick.storeDescription")}
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
                  <h3 className="font-semibold text-base">{t("home.quick.search")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("home.quick.searchDescription")}
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
