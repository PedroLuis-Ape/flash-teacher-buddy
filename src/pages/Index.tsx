import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useHomeData } from "@/hooks/useHomeData";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeCardList } from "@/components/ape/ApeCardList";
import { ApeSectionTitle } from "@/components/ape/ApeSectionTitle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Play } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { last, recents, loading } = useHomeData();

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

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Continue Studying Card */}
        {loading ? (
          <Skeleton className="h-[88px] w-full rounded-xl" />
        ) : last && total > 0 ? (
          <Card className="p-4 bg-gradient-to-br from-primary/10 to-secondary/10">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base mb-1">
                  Voltar para onde parou
                </h3>
                <p className="text-sm text-muted-foreground mb-1 line-clamp-2">
                  {last.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {getModeLabel(last.mode)} • {done}/{total} cards
                </p>
              </div>
              <Button 
                onClick={() => navigate(`/list/${last.id}/study`, { state: { mode: last.mode } })}
                className="shrink-0 min-h-[44px]"
                size="sm"
              >
                <Play className="h-4 w-4 mr-2" />
                Continuar
              </Button>
            </div>
            {total > 0 && <Progress value={pct} className="h-2" />}
          </Card>
        ) : null}

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
              </Button>
            }
          >
            Listas Recentes
          </ApeSectionTitle>

          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : !hasData ? (
            <div className="text-center py-12">
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
            </div>
          ) : recents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Nenhuma lista recente
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recents.map((list) => (
                <ApeCardList
                  key={list.id}
                  title={list.title}
                  cardCount={list.count}
                  onClick={() => navigate(`/list/${list.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
