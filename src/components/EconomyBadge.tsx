import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEconomy } from "@/contexts/EconomyContext";
import pitecoinIcon from "@/assets/pitecoin.png";

export function EconomyBadge() {
  const { balance_pitecoin } = useEconomy();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1.5 cursor-help">
          <img src={pitecoinIcon} alt="PITECOIN" className="h-4 w-4" />
          <span className="font-semibold">₱{balance_pitecoin}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">PITECOIN — moeda simbólica da série APE</p>
      </TooltipContent>
    </Tooltip>
  );
}
