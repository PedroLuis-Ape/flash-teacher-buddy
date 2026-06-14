/**
 * PublicShell — minimal chrome for public/anonymous routes.
 *
 * Phase 5 (Clara Master): landing, /auth, /auth/callback, SEO pages and
 * /portal/* render through this shell. It deliberately omits Economy,
 * Institution, heartbeat, notifications, GoogleConnectPrompt and
 * BrowserCheck so unauthenticated visitors never pay the cost of
 * private providers (and so those providers never trigger redundant
 * Supabase calls outside the app surface).
 */
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatVersionLabel } from "@/lib/versionManager";

interface PublicShellProps {
  children: ReactNode;
}

export function PublicShell({ children }: PublicShellProps) {
  return (
    <>
      {children}
      <div className="fixed bottom-3 right-3 z-50 pointer-events-none">
        <Badge variant="secondary" className="opacity-70 text-[10px] shadow-sm">
          {formatVersionLabel()}
        </Badge>
      </div>
    </>
  );
}