import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEconomy } from "@/contexts/EconomyContext";
import pitecoinIcon from "@/assets/pitecoin.png";
import { Trophy, Package, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";

export function CurrencyHeader() {
  const { pts_weekly, balance_pitecoin, inventory_count, loading } = useEconomy();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {isOffline && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1.5 cursor-help border-destructive text-destructive">
              <WifiOff className="h-4 w-4" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Sem conexão</p>
          </TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1.5 cursor-help min-h-[44px] px-3">
            <Trophy className="h-4 w-4 text-yellow-500" aria-hidden="true" />
            <span className="font-semibold">{pts_weekly} PTS</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Pontos desta semana</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1.5 cursor-help min-h-[44px] px-3">
            <img 
              src={pitecoinIcon} 
              alt="" 
              className="h-4 w-4"
              aria-hidden="true"
            />
            <span className="font-semibold">₱{balance_pitecoin}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">P₽ — moeda da série APE</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1.5 cursor-help min-h-[44px] px-3">
            <Package className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="font-semibold">{inventory_count} Itens</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Total de itens no inventário</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
