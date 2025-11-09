import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeCardList } from "@/components/ape/ApeCardList";
import { ApeGrid } from "@/components/ape/ApeGrid";
import { ApeSectionTitle } from "@/components/ape/ApeSectionTitle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Play } from "lucide-react";

interface RecentList {
  id: string;
  title: string;
  card_count: number;
  lang?: string;
}

interface ContinueStudy {
  list_id: string;
  list_title: string;
  mode: string;
  progress: number;
  current_index: number;
  total_cards: number;
}

const Index = () => {
  const navigate = useNavigate();
  const [recentLists, setRecentLists] = useState<RecentList[]>([]);
  const [continueStudy, setContinueStudy] = useState<ContinueStudy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }

    loadData(session.user.id);
  };

  const loadData = async (userId: string) => {
    try {
      // Load continue studying
      const { data: sessionData } = await supabase
        .from("study_sessions")
        .select(`
          list_id,
          mode,
          current_index,
          cards_order,
          lists (
            id,
            title
          )
        `)
        .eq("user_id", userId)
        .eq("completed", false)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionData && sessionData.lists) {
        const cardsOrder = sessionData.cards_order as any[];
        setContinueStudy({
          list_id: sessionData.list_id,
          list_title: (sessionData.lists as any).title,
          mode: sessionData.mode,
          progress: (sessionData.current_index / cardsOrder.length) * 100,
          current_index: sessionData.current_index,
          total_cards: cardsOrder.length,
        });
      }

      // Load recent lists (simplified)
      const { data: listsData } = await supabase
        .from("lists")
        .select(`
          id,
          title,
          lang,
          flashcards(id)
        `)
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (listsData) {
        const processed = listsData.map((list: any) => ({
          id: list.id,
          title: list.title,
          card_count: list.flashcards?.length || 0,
          lang: list.lang,
        }));
        setRecentLists(processed);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Início" />

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Continue Studying Card */}
        {continueStudy && (
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">
                  Voltar para onde parou
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {continueStudy.list_title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {getModeLabel(continueStudy.mode)} • {continueStudy.current_index}/{continueStudy.total_cards} cards
                </p>
              </div>
              <Button 
                onClick={() => navigate(`/list/${continueStudy.list_id}/study`, { state: { mode: continueStudy.mode } })}
                className="shrink-0"
              >
                <Play className="h-4 w-4 mr-2" />
                Continuar
              </Button>
            </div>
            <Progress value={continueStudy.progress} className="h-2" />
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
              >
                Ver tudo
              </Button>
            }
          >
            Listas Recentes
          </ApeSectionTitle>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Carregando...
            </div>
          ) : recentLists.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Você ainda não tem listas de estudo
              </p>
              <Button onClick={() => navigate("/folders")}>
                Criar sua primeira lista
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentLists.map((list) => (
                <ApeCardList
                  key={list.id}
                  title={list.title}
                  cardCount={list.card_count}
                  language={list.lang}
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
