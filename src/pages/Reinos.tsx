import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Lock, CheckCircle2, ArrowLeft, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Kingdom {
  code: string;
  name: string;
  order_index: number;
  icon_url: string | null;
  unlock_rule: {
    unlocked?: boolean;
    requires_xp?: number;
    requires_accuracy?: number;
    requires_kingdom?: string;
  };
}

interface KingdomProgress {
  kingdom_code: string;
  completed_count: number;
  total_count: number;
  accuracy_pct: number;
  xp_earned: number;
}

export default function Reinos() {
  const navigate = useNavigate();
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [progress, setProgress] = useState<Record<string, KingdomProgress>>({});
  const [loading, setLoading] = useState(true);
  const [isDeveloperAdmin, setIsDeveloperAdmin] = useState(false);

  useEffect(() => {
    loadKingdoms();
  }, []);

  const loadKingdoms = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if developer_admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (roles && roles.role === "developer_admin") {
        setIsDeveloperAdmin(true);
      }

      // Load kingdoms
      const { data: kingdomsData, error: kingdomsError } = await supabase
        .from("kingdoms")
        .select("*")
        .order("order_index");

      if (kingdomsError) throw kingdomsError;

      // Load user progress
      const { data: progressData, error: progressError } = await supabase
        .from("kingdom_progress")
        .select("*")
        .eq("user_id", session.user.id);

      if (progressError) throw progressError;

      // Convert progress to map
      const progressMap: Record<string, KingdomProgress> = {};
      progressData?.forEach((p) => {
        progressMap[p.kingdom_code] = p;
      });

      // Cast to correct types
      const typedKingdoms = (kingdomsData || []).map((k) => ({
        ...k,
        unlock_rule: k.unlock_rule as {
          unlocked?: boolean;
          requires_xp?: number;
          requires_accuracy?: number;
          requires_kingdom?: string;
        },
      }));

      setKingdoms(typedKingdoms);
      setProgress(progressMap);
    } catch (error) {
      console.error("Error loading kingdoms:", error);
      toast.error("Erro ao carregar reinos");
    } finally {
      setLoading(false);
    }
  };

  const checkUnlocked = (kingdom: Kingdom): { unlocked: boolean; reason?: string } => {
    const rule = kingdom.unlock_rule;
    
    if (rule.unlocked) return { unlocked: true };

    // Check if requires another kingdom
    if (rule.requires_kingdom) {
      const requiredProgress = progress[rule.requires_kingdom];
      if (!requiredProgress || requiredProgress.completed_count === 0) {
        return {
          unlocked: false,
          reason: `Complete o ${rule.requires_kingdom} primeiro`
        };
      }
    }

    // Check XP requirement
    if (rule.requires_xp && rule.requires_kingdom) {
      const requiredProgress = progress[rule.requires_kingdom];
      if (!requiredProgress || requiredProgress.xp_earned < rule.requires_xp) {
        return {
          unlocked: false,
          reason: `Requer ${rule.requires_xp} XP no ${rule.requires_kingdom}`
        };
      }
    }

    // Check accuracy requirement
    if (rule.requires_accuracy && rule.requires_kingdom) {
      const requiredProgress = progress[rule.requires_kingdom];
      if (!requiredProgress || requiredProgress.accuracy_pct < rule.requires_accuracy) {
        return {
          unlocked: false,
          reason: `Requer ${rule.requires_accuracy}% de precisão no ${rule.requires_kingdom}`
        };
      }
    }

    return { unlocked: true };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Crown className="h-12 w-12 animate-pulse mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando Reinos...</p>
        </div>
      </div>
    );
  }

  if (kingdoms.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center">
          <Crown className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Em Breve</h2>
          <p className="text-muted-foreground mb-4">
            O Modo Reino está sendo preparado. Volte em breve!
          </p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 lg:px-8 pb-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Crown className="h-8 w-8 text-primary" />
              Modo Reino
            </h1>
            <p className="text-muted-foreground">
              Complete atividades e desbloqueie novos reinos
            </p>
          </div>
          {isDeveloperAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/reino/importar")}
            >
              <Upload className="mr-2 h-4 w-4" />
              Importar CSV
            </Button>
          )}
        </div>

        {/* Kingdoms List */}
        <div className="space-y-4">
          {kingdoms.map((kingdom) => {
            const unlockStatus = checkUnlocked(kingdom);
            const kingdomProgress = progress[kingdom.code];

            return (
              <Card
                key={kingdom.code}
                className={`p-6 transition-all ${
                  unlockStatus.unlocked
                    ? "hover:shadow-lg cursor-pointer"
                    : "opacity-60"
                }`}
                onClick={() => {
                  if (unlockStatus.unlocked) {
                    navigate(`/reino/${kingdom.code}`);
                  }
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {unlockStatus.unlocked ? (
                      <Crown className="h-12 w-12 text-primary" />
                    ) : (
                      <Lock className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-2xl font-bold">{kingdom.name}</h2>
                      {unlockStatus.unlocked ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                          🔓 Liberado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted">
                          🔒 Bloqueado
                        </Badge>
                      )}
                    </div>

                    {kingdomProgress && (
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>
                            {kingdomProgress.completed_count}/{kingdomProgress.total_count} completas
                          </span>
                        </div>
                        <div>
                          ⭐ {kingdomProgress.xp_earned} XP
                        </div>
                        <div>
                          🎯 {kingdomProgress.accuracy_pct.toFixed(0)}% precisão
                        </div>
                      </div>
                    )}

                    {!unlockStatus.unlocked && unlockStatus.reason && (
                      <p className="text-sm text-muted-foreground">
                        {unlockStatus.reason}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
