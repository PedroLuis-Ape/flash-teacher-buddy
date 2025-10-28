import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getEconomyProfile } from "@/lib/rewardEngine";
import { supabase } from "@/integrations/supabase/client";
import pitecoinIcon from "@/assets/pitecoin.png";

export function EconomyBadge() {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    loadBalance();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('economy_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${supabase.auth.getUser().then(r => r.data.user?.id)}`,
        },
        (payload) => {
          if (payload.new && 'balance_pitecoin' in payload.new) {
            setBalance((payload.new as any).balance_pitecoin || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadBalance = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const profile = await getEconomyProfile(session.user.id);
    if (profile) {
      setBalance(profile.balance_pitecoin);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1.5 cursor-help">
          <img src={pitecoinIcon} alt="PITECOIN" className="h-4 w-4" />
          <span className="font-semibold">₱{balance}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">PITECOIN — moeda simbólica da série APE</p>
      </TooltipContent>
    </Tooltip>
  );
}
