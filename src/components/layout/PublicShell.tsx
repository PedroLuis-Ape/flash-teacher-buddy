import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { PublicGalaxyGate } from "@/components/layout/PublicGalaxyGate";
import { GuestHistoryTracker } from "@/components/portal/GuestHistoryTracker";
import { BrowserExtensionQuickInstall } from "@/features/browser-extension/BrowserExtensionQuickInstall";
import { formatVersionLabel } from "@/lib/versionManager";
import "@/styles/space-ui-v1.css";
import "@/styles/space-layouts.css";
import "@/styles/space-ui-button-emojis.css";
import "@/styles/space-galaxy-home-mobile-hotfix.css";

interface PublicShellProps {
  children: ReactNode;
}

export function PublicShell({ children }: PublicShellProps) {
  const location = useLocation();
  const showExtensionShortcut = location.pathname === "/" || location.pathname === "/landing";

  return (
    <div className="space-ui space-ui-shell min-h-screen">
      <PublicGalaxyGate />
      <GuestHistoryTracker />
      <div className="space-ui-main min-h-screen">{children}</div>
      {showExtensionShortcut && <BrowserExtensionQuickInstall />}
      <div className="space-ui-version-badge fixed bottom-3 right-3 z-50 pointer-events-none">
        <Badge variant="outline" className="bg-background text-foreground border-border text-[10px] shadow-sm">
          {formatVersionLabel()}
        </Badge>
      </div>
    </div>
  );
}
