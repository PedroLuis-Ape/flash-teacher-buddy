import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEconomy } from "@/contexts/EconomyContext";
import pitecoinIcon from "@/assets/pitecoin.png";
import { Trophy } from "lucide-react";

export function CurrencyHeader() {
  const { pts_weekly, balance_pitecoin, loading } = useEconomy();

  if (loading) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1.5 cursor-help">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="font-semibold">{pts_weekly} PTS</span>
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
            />
            <span className="font-semibold">₱{balance_pitecoin}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">PITECOIN — moeda da série APE</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
