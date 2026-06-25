import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getEconomyProfile, getNextConversionDate, type EconomyProfile } from "@/lib/rewardEngine";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Trophy, Zap, Calendar, ArrowRightLeft } from "lucide-react";
import pitecoinIcon from "@/assets/pitecoin.png";

export function StatisticsTab() {
  const navigate = useNavigate();
  const [economy, setEconomy] = useState<EconomyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadEconomy();
  }, []);

  const loadEconomy = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const profile = await getEconomyProfile(session.user.id);
      setEconomy(profile);
    } catch (error) {
      console.error("Error loading economy:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">Carregando estatísticas...</p>
        </CardContent>
      </Card>
    );
  }

  if (!economy) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">Erro ao carregar dados da economia</p>
        </CardContent>
      </Card>
    );
  }

  const xpForCurrentLevel = economy.level * economy.level * 100;
  const xpForNextLevel = (economy.level + 1) * (economy.level + 1) * 100;
  const xpProgress = Math.max(0, economy.xp_total - xpForCurrentLevel);
  const xpNeeded = Math.max(1, xpForNextLevel - xpForCurrentLevel);
  const progressPercent = Math.min(100, (xpProgress / xpNeeded) * 100);

  const nextConversion = getNextConversionDate();
  const daysUntilConversion = Math.ceil((nextConversion.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Progresso e PiteCOIN</CardTitle>
        <CardDescription>
          XP aumenta seu nível, PTS podem ser convertidos e PiteCOIN compra pacotes da loja.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-semibold">Nível {economy.level}</span>
            </div>
            <Badge variant="outline">
              {xpProgress.toLocaleString("pt-BR")} / {xpNeeded.toLocaleString("pt-BR")} XP
            </Badge>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {Math.max(0, xpNeeded - xpProgress).toLocaleString("pt-BR")} XP até o próximo nível
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>XP Total</span>
            </div>
            <p className="text-2xl font-bold">{economy.xp_total.toLocaleString("pt-BR")}</p>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              <span>PTS disponíveis</span>
            </div>
            <p className="text-2xl font-bold">{economy.pts_weekly.toLocaleString("pt-BR")}</p>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <img src={pitecoinIcon} alt="" className="h-4 w-4" />
              <span>PiteCOIN</span>
            </div>
            <p className="text-2xl font-bold">₱{economy.balance_pitecoin.toLocaleString("pt-BR")}</p>
          </div>
        </div>

        {economy.current_streak > 0 && (
          <div className="rounded-lg border bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Sequência atual</p>
                <p className="text-sm text-muted-foreground">
                  {economy.current_streak} {economy.current_streak === 1 ? "dia" : "dias"} consecutivos
                </p>
              </div>
              <Badge variant="secondary" className="text-lg">
                🔥 {economy.current_streak}
              </Badge>
            </div>
            {economy.best_streak > economy.current_streak && (
              <p className="mt-2 text-xs text-muted-foreground">
                Melhor sequência: {economy.best_streak} dias
              </p>
            )}
          </div>
        )}

        {FEATURE_FLAGS.conversion_cron_enabled ? (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Próxima conversão automática</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Domingo, 23:59 ({daysUntilConversion} {daysUntilConversion === 1 ? "dia" : "dias"})
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Câmbio manual</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Seus PTS ficam guardados até você decidir convertê-los em PiteCOIN.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => navigate("/store/exchange")}>
              Abrir câmbio
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
