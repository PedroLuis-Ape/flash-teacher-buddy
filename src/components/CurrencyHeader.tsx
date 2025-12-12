import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEconomy } from "@/contexts/EconomyContext";
import pitecoinIcon from "@/assets/pitecoin.png";
import { Trophy, Package, WifiOff, ChevronDown } from "lucide-react";
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
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-20" />
      </div>
    );
  }

  // Mobile: Show only PTS with dropdown for others
  // Desktop: Show all badges
  return (
    <div className="flex items-center gap-2">
      {isOffline && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 cursor-help border-destructive text-destructive h-9 px-2">
              <WifiOff className="h-4 w-4" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Sem conexão</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Mobile: Primary metric + dropdown */}
      <div className="flex md:hidden items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1.5 cursor-help h-9 px-2.5">
              <Trophy className="h-4 w-4 text-warning shrink-0" aria-hidden="true" />
              <span className="font-semibold text-sm">{pts_weekly}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Pontos desta semana</p>
          </TooltipContent>
        </Tooltip>

        <Popover>
          <PopoverTrigger asChild>
            <Badge variant="outline" className="gap-1 cursor-pointer h-9 px-2 hover:bg-muted">
              <ChevronDown className="h-3.5 w-3.5" />
            </Badge>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-warning shrink-0" />
                  <span className="text-sm text-muted-foreground">PTS</span>
                </div>
                <span className="font-semibold">{pts_weekly}</span>
              </div>
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <img src={pitecoinIcon} alt="" className="h-4 w-4 shrink-0" />
                  <span className="text-sm text-muted-foreground">Pitecoin</span>
                </div>
                <span className="font-semibold">₱{balance_pitecoin}</span>
              </div>
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm text-muted-foreground">Itens</span>
                </div>
                <span className="font-semibold">{inventory_count}</span>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Desktop: All badges visible */}
      <div className="hidden md:flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1.5 cursor-help h-9 px-3">
              <Trophy className="h-4 w-4 text-warning shrink-0" aria-hidden="true" />
              <span className="font-semibold">{pts_weekly} PTS</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Pontos desta semana</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1.5 cursor-help h-9 px-3">
              <img 
                src={pitecoinIcon} 
                alt="" 
                className="h-4 w-4 shrink-0"
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
            <Badge variant="outline" className="gap-1.5 cursor-help h-9 px-3">
              <Package className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <span className="font-semibold">{inventory_count}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Total de itens no inventário</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
