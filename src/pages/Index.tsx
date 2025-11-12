import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useHomeData } from "@/hooks/useHomeData";
import { useEconomy } from "@/contexts/EconomyContext";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeCardList } from "@/components/ape/ApeCardList";
import { ApeCardProfessor } from "@/components/ape/ApeCardProfessor";
import { ApeSectionTitle } from "@/components/ape/ApeSectionTitle";
import { TurmasCard } from "@/components/TurmasCard";
import { MeusAlunosCard } from "@/components/MeusAlunosCard";
import { MinhasTurmasCard } from "@/components/MinhasTurmasCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Play, TrendingUp, Users, Layers, ChevronRight, Crown, Lock } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { last, recents, teachers, stats, loading } = useHomeData();
  const { pts_weekly, level, current_streak } = useEconomy();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth", { replace: true });
    }
  };

  const getModeLabel = (mode: string) => {
    const labels: Record<string, string> = {
      flip: "Revisar",
      write: "Escrever",
      multiple: "Múltipla escolha",
      unscramble: "Desembaralhar",
    };
    return labels[mode] || mode;
  };

  // Defensive progress math
  const total = Math.max(0, Number(last?.total) || 0);
  const done = Math.min(total, Math.max(0, Number(last?.reviewed) || 0));
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const hasData = last !== null || recents.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Início" />

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Stats Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 sm:h-20 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/profile")}>
              <CardContent className="p-2.5 sm:p-4 text-center">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-0.5 sm:mb-1 text-primary" />
                <p className="text-xl sm:text-2xl font-bold">{pts_weekly}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">PTS Semanal</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/profile")}>
              <CardContent className="p-2.5 sm:p-4 text-center">
                <div className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-0.5 sm:mb-1 flex items-center justify-center text-primary font-bold text-base sm:text-lg">
                  {level}
                </div>
                <p className="text-xl sm:text-2xl font-bold">{current_streak}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Dias seguidos</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/folders")}>
              <CardContent className="p-2.5 sm:p-4 text-center">
                <Layers className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-0.5 sm:mb-1 text-primary" />
                <p className="text-xl sm:text-2xl font-bold">{stats.total_lists}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Listas</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Essential Cards - Professor/Student Actions */}
        {!loading && (
          <div className="space-y-3">
            {/* Professor Cards */}
            <MeusAlunosCard />
            <MinhasTurmasCard />
            
            {/* Student Turmas Card */}
            {FEATURE_FLAGS.classes_enabled && <TurmasCard />}
          </div>
        )}

        {/* Teachers Section */}
        <div className="space-y-4">
          <ApeSectionTitle
            action={
              teachers.length > 0 ? (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate("/my-teachers")}
                  className="min-h-[44px]"
                >
                  Ver todos
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate("/search")}
                  className="min-h-[44px]"
                >
                  Buscar
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )
            }
          >
            <Users className="h-5 w-5 mr-2" />
            Meus Professores
          </ApeSectionTitle>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : teachers.length > 0 ? (
            <div className="space-y-3">
              {teachers.map((teacher) => (
                <ApeCardProfessor
                  key={teacher.id}
                  name={teacher.name}
                  folderCount={teacher.folder_count}
                  onClick={() => navigate("/my-teachers")}
                />
              ))}
            </div>
          ) : (
            <Card className="text-center py-8">
              <CardContent>
                <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Você ainda não segue nenhum professor
                </p>
                <Button 
                  onClick={() => navigate("/search")}
                  className="min-h-[44px]"
                >
                  Buscar Professores
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Continue Studying Card */}
        {loading ? (
          <Skeleton className="h-[76px] sm:h-[88px] w-full rounded-xl" />
        ) : last && total > 0 ? (
          <Card className="p-3 sm:p-4 bg-gradient-to-br from-primary/10 to-secondary/10 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between gap-3 mb-2 sm:mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                  Voltar para onde parou
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1 line-clamp-1">
                  {last.title}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                  {getModeLabel(last.mode)} • {done}/{total} cards
                </p>
              </div>
              <Button 
                onClick={() => navigate(`/list/${last.id}/study`, { state: { mode: last.mode } })}
                className="shrink-0 h-12 w-12 sm:h-10 sm:w-auto sm:px-4"
                size="sm"
              >
                <Play className="h-5 w-5 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Continuar</span>
              </Button>
            </div>
            {total > 0 && <Progress value={pct} className="h-1.5 sm:h-2" />}
          </Card>
        ) : null}

        {/* Modo Reino Card - Bloqueado */}
        {!loading && FEATURE_FLAGS.reinos_enabled && (
          <Card 
            className="p-3 sm:p-4 bg-black/50 border-dashed border-muted min-h-[70px] sm:min-h-[88px] flex items-center opacity-60 cursor-not-allowed relative overflow-hidden"
            role="button"
            tabIndex={-1}
            aria-label="Modo Reino - Bloqueado"
          >
            <div className="absolute top-2 right-2">
              <div className="h-6 w-6 rounded-full bg-muted/20 flex items-center justify-center">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 w-full">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-yellow-500/10 to-orange-500/10 flex items-center justify-center shrink-0">
                <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500/50" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base text-muted-foreground mb-0.5 sm:mb-1">
                  Modo Reino
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground/70">
                  🔒 Em breve
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Recent Lists */}
        <div className="space-y-4">
          <ApeSectionTitle
            action={
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/folders")}
                className="min-h-[44px]"
              >
                Ver tudo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            }
          >
            <BookOpen className="h-5 w-5 mr-2" />
            Listas para Estudar
          </ApeSectionTitle>

          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : !hasData ? (
            <Card className="text-center py-12">
              <CardContent>
                <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Você ainda não tem listas de estudo
                </p>
                <Button 
                  onClick={() => navigate("/folders")}
                  className="min-h-[44px]"
                >
                  Criar sua primeira lista
                </Button>
              </CardContent>
            </Card>
          ) : recents.length === 0 ? (
            <Card className="text-center py-8">
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Nenhuma lista disponível
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recents.map((list) => (
                <ApeCardList
                  key={list.id}
                  title={list.title}
                  subtitle={list.folder_name}
                  cardCount={list.count}
                  badge={list.is_own ? undefined : "Compartilhado"}
                  onClick={() => navigate(`/list/${list.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3 pb-4">
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={() => navigate("/store")}
            >
              <div className="text-2xl">🏪</div>
              <span className="text-sm">Loja</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={() => navigate("/search")}
            >
              <Users className="h-6 w-6" />
              <span className="text-sm">Buscar Professores</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
