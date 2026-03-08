import { useOnlineStatus } from "@/hooks/useOffline";
import { WifiOff } from "lucide-react";

/** Shows a small banner when the app is offline */
export function OfflineIndicator() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground text-center text-xs py-1 font-medium flex items-center justify-center gap-1.5">
      <WifiOff className="h-3 w-3" />
      Você está offline
    </div>
  );
}
