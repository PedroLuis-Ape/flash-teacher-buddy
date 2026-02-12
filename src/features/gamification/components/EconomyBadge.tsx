import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEconomy } from "@/contexts/EconomyContext";
import pitecoinIcon from "@/assets/pitecoin.png";

export function EconomyBadge() {
  const { balance_pitecoin } = useEconomy();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1 sm:gap-1.5 cursor-help px-1.5 sm:px-2.5 h-7 sm:h-8">
          <img src={pitecoinIcon} alt="PITECOIN" className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="font-semibold text-xs sm:text-sm">₱{balance_pitecoin}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">PITECOIN — moeda simbólica da série APE</p>
      </TooltipContent>
    </Tooltip>
  );
}
