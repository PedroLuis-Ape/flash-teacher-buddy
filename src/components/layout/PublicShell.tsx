import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { PublicGalaxyGate } from "@/components/layout/PublicGalaxyGate";
import { GuestHistoryTracker } from "@/components/portal/GuestHistoryTracker";
import { DynamicPublicEditorialNote } from "@/components/seo/DynamicPublicEditorialNote";
import { BrowserExtensionQuickInstall } from "@/features/browser-extension/BrowserExtensionQuickInstall";
import { useVisualPreferences } from "@/hooks/useVisualPreferences";
import { formatVersionLabel } from "@/lib/versionManager";
import { cn } from "@/lib/utils";
import "@/styles/space-ui-v1.css";
import "@/styles/space-layouts.css";
import "@/styles/space-ui-button-emojis.css";
import "@/styles/space-galaxy-home-mobile-hotfix.css";
import "@/styles/piteco-play-public.css";

interface PublicShellProps {
  children: ReactNode;
}

export function PublicShell({ children }: PublicShellProps) {
  const location = useLocation();
  const { visualStyle } = useVisualPreferences();
  const showExtensionShortcut = location.pathname === "/" || location.pathname === "/landing";
  const playful = visualStyle === "playful";
  const showVersionBadge = !(playful && location.pathname.startsWith("/auth"));

  return (
    <div
      className={cn(
        "min-h-screen",
        playful ? "ape-public-shell" : "space-ui space-ui-shell",
      )}
      data-ape-public-style={playful ? "playful" : "legacy"}
    >
      <PublicGalaxyGate />
      <GuestHistoryTracker />
      <div className={cn("min-h-screen", playful ? "ape-public-main" : "space-ui-main")}>
        {children}
      </div>
      <DynamicPublicEditorialNote />
      {showExtensionShortcut && <BrowserExtensionQuickInstall />}
      {showVersionBadge && (
        <div
          className={cn(
            "fixed bottom-3 right-3 z-50 pointer-events-none",
            playful ? "ape-public-version-badge" : "space-ui-version-badge",
          )}
        >
          <Badge variant="outline" className="bg-background text-foreground border-border text-[10px] shadow-sm">
            {formatVersionLabel()}
          </Badge>
        </div>
      )}
    </div>
  );
}
