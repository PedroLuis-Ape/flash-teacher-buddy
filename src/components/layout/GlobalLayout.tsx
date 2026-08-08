import { useEffect, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useFreezeWatchdog } from "@/hooks/useFreezeWatchdog";
import { useAuth } from "@/contexts/AuthContext";
import { isProtectedPath } from "@/lib/sessionRouteAccess";
import { PublicShell } from "@/components/layout/PublicShell";
import { PrivateShell } from "@/components/layout/PrivateShell";
import { PortalHistorySyncAgent } from "@/components/portal/PortalHistorySyncAgent";
import { MixedModeRecommendationBubble } from "@/features/study/components/MixedModeRecommendationBubble";
import { MobilePortraitOnlyGate } from "@/components/layout/MobilePortraitOnlyGate";
import { installPortraitOrientationGuard } from "@/lib/portraitOrientationLock";

interface GlobalLayoutProps {
  children: ReactNode;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, status } = useAuth();
  useFreezeWatchdog();

  useEffect(() => installPortraitOrientationGuard(), []);

  // Keep the private shell unmounted until AuthProvider has confirmed the
  // session. Private pages perform queries/effects during render, so letting
  // them mount while auth is initializing can expose stale identity data or
  // trigger writes under the wrong session. AuthHydrationGate still owns the
  // visible loading/error state inside the shell.
  const shouldUsePrivateShell = status === "authenticated" && isProtectedPath(location.pathname);
  const content = !shouldUsePrivateShell
    ? <PublicShell>{children}</PublicShell>
    : <PrivateShell>{children}</PrivateShell>;

  const portraitOnlySession =
    location.pathname.endsWith("/study") ||
    location.pathname.endsWith("/mixed-study");

  return (
    <>
      <PortalHistorySyncAgent />
      {content}
      <MobilePortraitOnlyGate active={portraitOnlySession} />
      <MixedModeRecommendationBubble />
      {location.pathname === "/import" && user && (
        <div className="fixed bottom-24 right-4 z-50 sm:bottom-8 sm:right-8">
          <Button
            size="lg"
            className="rounded-full shadow-lg"
            onClick={() => navigate("/import/super")}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Super Importador Global
          </Button>
        </div>
      )}
    </>
  );
}
