import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import pitecoinIcon from "@/assets/pitecoin.png";
import { Trophy } from "lucide-react";

export function CurrencyHeader() {
  const [ptsWeekly, setPtsWeekly] = useState(0);
  const [balancePitecoin, setBalancePitecoin] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBalances();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('currency_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${supabase.auth.getUser().then(r => r.data.user?.id)}`,
        },
        (payload) => {
          if (payload.new) {
            const newData = payload.new as any;
            setPtsWeekly(newData.pts_weekly || 0);
            setBalancePitecoin(newData.balance_pitecoin || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadBalances = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('pts_weekly, balance_pitecoin')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error loading balances:', error);
        setLoading(false);
        return;
      }

      if (data) {
        setPtsWeekly(data.pts_weekly || 0);
        setBalancePitecoin(data.balance_pitecoin || 0);
      }
    } catch (err) {
      console.error('Exception loading balances:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1.5 cursor-help">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="font-semibold">{ptsWeekly} PTS</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Pontos desta semana</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1.5 cursor-help">
            <img 
              src={pitecoinIcon} 
              alt="PITECOIN" 
              className="h-4 w-4"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = document.createElement('div');
                fallback.className = 'h-4 w-4 rounded-full bg-muted flex items-center justify-center text-xs';
                fallback.textContent = '₱';
                e.currentTarget.parentElement?.insertBefore(fallback, e.currentTarget);
              }}
            />
            <span className="font-semibold">₱{balancePitecoin}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">PITECOIN — moeda da série APE</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}