import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getEconomyProfile, getNextConversionDate, type EconomyProfile } from "@/lib/rewardEngine";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Trophy, Zap, Calendar } from "lucide-react";

export function StatisticsTab() {
  const [economy, setEconomy] = useState<EconomyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEconomy();
  }, []);

  const loadEconomy = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const profile = await getEconomyProfile(session.user.id);
      setEconomy(profile);
    } catch (error) {
      console.error('Error loading economy:', error);
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
          <p className="text-center text-muted-foreground">Erro ao carregar dados</p>
        </CardContent>
      </Card>
    );
  }

  const xpForCurrentLevel = economy.level * economy.level * 100;
  const xpForNextLevel = (economy.level + 1) * (economy.level + 1) * 100;
  const xpProgress = economy.xp_total - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  const progressPercent = (xpProgress / xpNeeded) * 100;

  const nextConversion = getNextConversionDate();
  const daysUntilConversion = Math.ceil((nextConversion.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estatísticas</CardTitle>
        <CardDescription>
          Seu progresso e recompensas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Level Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-semibold">Nível {economy.level}</span>
            </div>
            <Badge variant="outline">
              {xpProgress.toLocaleString()} / {xpNeeded.toLocaleString()} XP
            </Badge>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {(xpNeeded - xpProgress).toLocaleString()} XP até o próximo nível
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>XP Total</span>
            </div>
            <p className="text-2xl font-bold">{economy.xp_total.toLocaleString()}</p>
          </div>

          <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              <span>PTS Semana</span>
            </div>
            <p className="text-2xl font-bold">{economy.pts_weekly} / 1500</p>
            <Progress value={(economy.pts_weekly / 1500) * 100} className="h-1" />
          </div>
        </div>

        {/* Streak Info */}
        {economy.current_streak > 0 && (
          <div className="p-4 border rounded-lg bg-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Sequência Atual</p>
                <p className="text-sm text-muted-foreground">
                  {economy.current_streak} {economy.current_streak === 1 ? 'dia' : 'dias'} consecutivos
                </p>
              </div>
              <Badge variant="secondary" className="text-lg">
                🔥 {economy.current_streak}
              </Badge>
            </div>
            {economy.best_streak > economy.current_streak && (
              <p className="text-xs text-muted-foreground mt-2">
                Melhor sequência: {economy.best_streak} dias
              </p>
            )}
          </div>
        )}

        {/* Next Conversion */}
        <div className="p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Próxima Conversão</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Domingo, 23:59 ({daysUntilConversion} {daysUntilConversion === 1 ? 'dia' : 'dias'})
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Seus {economy.pts_weekly} PTS serão convertidos em ~₱{Math.floor(Math.min(economy.pts_weekly, 1500) / 10)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
