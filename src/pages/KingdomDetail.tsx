import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Activity {
  id: string;
  kingdom_code: string;
  level_code: string;
  unit: string;
  activity_type: string;
  prompt: string;
  hint: string | null;
  canonical_answer: string;
  alt_answers: string[] | null;
  choices: any[] | null;
  lang: string;
  points: number | null;
  tags: string[] | null;
}

interface ActivityProgress {
  activity_id: string;
  status: string;
  best_score: number;
  attempts: number;
}

export default function KingdomDetail() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [progress, setProgress] = useState<Record<string, ActivityProgress>>({});
  const [loading, setLoading] = useState(true);
  const [kingdom, setKingdom] = useState<any>(null);

  useEffect(() => {
    if (code) {
      loadKingdomData();
    }
  }, [code]);

  const loadKingdomData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Load kingdom info
      const { data: kingdomData, error: kingdomError } = await supabase
        .from("kingdoms")
        .select("*")
        .eq("code", code)
        .single();

      if (kingdomError) throw kingdomError;
      setKingdom(kingdomData);

      // Load activities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from("kingdom_activities")
        .select("*")
        .eq("kingdom_code", code)
        .order("level_code")
        .order("unit");

      if (activitiesError) throw activitiesError;

      // Load user progress
      const activityIds = activitiesData?.map((a) => a.id) || [];
      const { data: progressData, error: progressError } = await supabase
        .from("activity_progress")
        .select("*")
        .eq("user_id", session.user.id)
        .in("activity_id", activityIds);

      if (progressError) throw progressError;

      // Convert progress to map
      const progressMap: Record<string, ActivityProgress> = {};
      progressData?.forEach((p) => {
        progressMap[p.activity_id] = p;
      });

      // Cast to correct types
      const typedActivities = (activitiesData || []).map((a) => ({
        ...a,
        alt_answers: a.alt_answers as string[] | null,
        choices: a.choices as any[] | null,
        tags: a.tags as string[] | null,
      }));
      
      setActivities(typedActivities);
      setProgress(progressMap);
    } catch (error) {
      console.error("Error loading kingdom data:", error);
      toast.error("Erro ao carregar atividades");
    } finally {
      setLoading(false);
    }
  };

  const getActivityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      translate: "📝 Traduzir",
      multiple_choice: "✔️ Múltipla Escolha",
      dictation: "🎧 Ditado",
      fill_blank: "✍️ Preencher",
      order_words: "🔤 Ordenar Palavras",
      match: "🔗 Combinar"
    };
    return labels[type] || type;
  };

  const getStatusBadge = (activityId: string) => {
    const prog = progress[activityId];
    if (!prog) return <Badge variant="outline">Novo</Badge>;
    if (prog.status === "perfect") return <Badge className="bg-green-500">Perfeito</Badge>;
    if (prog.status === "done") return <Badge variant="secondary">Feito</Badge>;
    return <Badge variant="outline">Novo</Badge>;
  };

  const handleStartActivity = (activity: Activity) => {
    // TODO: Navigate to activity game page
    toast.info("Jogabilidade em desenvolvimento");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!kingdom) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-2">Reino não encontrado</h2>
          <Button onClick={() => navigate("/reino")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Card>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-2">Sem atividades ainda</h2>
          <p className="text-muted-foreground mb-4">
            Este reino ainda não tem atividades disponíveis.
          </p>
          <Button onClick={() => navigate("/reino")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Card>
      </div>
    );
  }

  // Group by unit
  const groupedActivities = activities.reduce((acc, activity) => {
    const unit = activity.unit || "Outros";
    if (!acc[unit]) acc[unit] = [];
    acc[unit].push(activity);
    return acc;
  }, {} as Record<string, Activity[]>);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 lg:px-8 pb-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/reino")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{kingdom.name}</h1>
            <p className="text-muted-foreground">
              {activities.length} atividades disponíveis
            </p>
          </div>
        </div>

        {/* Activities by Unit */}
        <div className="space-y-6">
          {Object.entries(groupedActivities).map(([unit, unitActivities]) => (
            <div key={unit}>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                {unit}
              </h2>
              <div className="grid gap-3">
                {unitActivities.map((activity) => (
                  <Card
                    key={activity.id}
                    className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleStartActivity(activity)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {getActivityTypeLabel(activity.activity_type)}
                          </span>
                          {getStatusBadge(activity.id)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {activity.prompt}
                        </p>
                        {activity.hint && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            💡 {activity.hint}
                          </p>
                        )}
                      </div>
                      <Button size="sm" variant="ghost">
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
