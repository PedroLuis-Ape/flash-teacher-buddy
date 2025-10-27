import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getMockEconomy } from "@/lib/economyTypes";
import { Coins } from "lucide-react";

export function EconomyBadge() {
  const economy = getMockEconomy();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1.5 cursor-help">
          <Coins className="h-3.5 w-3.5" />
          <span className="font-semibold">₱{economy.balance_pitecoin}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Moeda simbólica da série APE</p>
      </TooltipContent>
    </Tooltip>
  );
}
