/**
 * PublicShell — minimal chrome for public/anonymous routes.
 *
 * Landing, auth, SEO pages, public classrooms and /portal/* render through
 * this shell. Private providers remain unmounted, while the optional galaxy
 * layer is loaded only when the visitor selects it.
 */
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { PublicGalaxyGate } from "@/components/layout/PublicGalaxyGate";
import { GuestHistoryTracker } from "@/components/portal/GuestHistoryTracker";
import { PortalHistorySyncAgent } from "@/components/portal/PortalHistorySyncAgent";
import { formatVersionLabel } from "@/lib/versionManager";
import "@/styles/space-ui-v1.css";
import "@/styles/space-layouts.css";

interface PublicShellProps {
  children: ReactNode;
}

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="space-ui space-ui-shell min-h-screen">
      <PublicGalaxyGate />
      <GuestHistoryTracker />
      <PortalHistorySyncAgent />
      <div className="space-ui-main min-h-screen">
        {children}
      </div>
      <div className="fixed bottom-3 right-3 z-50 pointer-events-none">
        <Badge variant="secondary" className="opacity-70 text-[10px] shadow-sm">
          {formatVersionLabel()}
        </Badge>
      </div>
    </div>
  );
}
