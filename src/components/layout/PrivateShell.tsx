/**
 * PrivateShell — full app chrome for authenticated routes.
 *
 * Phase 5 (Clara Master): mounts every private provider/side-effect that
 * used to live in App.tsx + GlobalLayout. Public routes (handled by
 * PublicShell) never instantiate any of this, so landing/auth/SEO/portal
 * boots without Economy or Institution.
 *
 * Behaviour is intentionally identical to the previous GlobalLayout for
 * private routes — only the mount point moved.
 */
import { ReactNode, useEffect, useState, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { CurrencyHeader } from "@/components/CurrencyHeader";
import { AdminButton } from "@/components/AdminButton";
import { ApeTabBar } from "@/components/ape/ApeTabBar";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { EconomyProvider } from "@/contexts/EconomyContext";
import { formatVersionLabel } from "@/lib/versionManager";
import { Badge } from "@/components/ui/badge";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { InstitutionProvider } from "@/contexts/InstitutionContext";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { SpaceTwinkleLayer } from "@/components/layout/SpaceTwinkleLayer";
import { useActivityHeartbeat } from "@/hooks/useActivityHeartbeat";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { usePerformance } from "@/contexts/PerformanceContext";
import { InstitutionBar } from "@/components/layout/InstitutionBar";
import { isSafeModeEnabled } from "@/lib/safeMode";
import { AppRecoveryBanner } from "@/components/AppRecoveryBanner";
import { PitecoLogo } from "@/features/gamification/components/PitecoLogo";
import "@/styles/space-ui-v1.css";
import "@/styles/space-ui-components.css";
import "@/styles/space-ui-widgets.css";
import "@/styles/space-ui-reference-match.css";
import "@/styles/space-ui-glitter.css";
import "@/styles/space-ui-piteco-fullbody.css";
import "@/styles/space-ui-live-stars.css";
import "@/styles/space-ui-performance.css";
import "@/styles/mobile-layout-guard.css";

const NotificationBell = lazy(() => import("@/components/NotificationBell").then(m => ({ default: m.NotificationBell })));
const PresentBoxBadge = lazy(() => import("@/features/gamification/components/PresentBoxBadge").then(m => ({ default: m.PresentBoxBadge })));
const GiftNotificationModal = lazy(() => import("@/components/GiftNotificationModal"));
const AnnouncementModal = lazy(() => import("@/components/AnnouncementModal"));
const EconomyInitializer = lazy(() => import("@/components/EconomyInitializer").then(m => ({ default: m.EconomyInitializer })));
const BrowserCheck = lazy(() => import("@/components/BrowserCheck").then(m => ({ default: m.BrowserCheck })));
const GoogleConnectPrompt = lazy(() => import("@/features/auth/components/GoogleConnectPrompt").then(m => ({ default: m.GoogleConnectPrompt })));

interface PrivateShellProps {
  children: ReactNode;
}

function PrivateShellInner({ children }: PrivateShellProps) {
  const location = useLocation();
  const { user } = useAuthUser();
  const { settings: perfSettings } = usePerformance();
  const safeMode = isSafeModeEnabled();
  const [secondaryReady, setSecondaryReady] = useState(false);

  useEffect(() => {
    if (!user || safeMode) return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) setSecondaryReady(true);
    };
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    const handle = ric
      ? ric(run, { timeout: 2500 })
      : (setTimeout(run, 1200) as unknown as number);
    return () => {
      cancelled = true;
      if (ric && (window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(handle);
      } else {
        clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
      }
    };
  }, [user?.id, safeMode]);

  useActivityHeartbeat(secondaryReady && !safeMode ? user?.id : undefined);
  useSwipeNavigation({ enabled: !!user && !safeMode && FEATURE_FLAGS.swipe_navigation_enabled });

  const isFullScreenPage = location.pathname.includes("/study");
  const isHome = location.pathname === "/dashboard";
  const isGameRoute = location.pathname.includes("/study") || location.pathname.includes("/games");
  const showSecondaryActions = !isGameRoute && !isHome;
  const showCurrencyHeader = !isHome && !isGameRoute;
  const showInstitutionBar = isHome;

  return (
    <div className="space-ui space-ui-shell min-h-screen w-full max-w-full overflow-x-clip flex flex-col">
      <SpaceTwinkleLayer />
      <AppRecoveryBanner />
      <OfflineIndicator />

      {FEATURE_FLAGS.currency_header_enabled && user && (
        <header
          className={cn(
            "space-ui-header sticky top-0 z-50 w-full max-w-full border-b",
            perfSettings.backdropBlur
              ? "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
              : "bg-background",
          )}
        >
          <div className="max-w-[1600px] mx-auto w-full flex h-12 md:h-14 items-center justify-between gap-2 md:gap-4 px-3 md:px-4 lg:px-8">
            <div className="flex min-w-0 items-center gap-1 md:gap-2">
              <AppSidebar />
              <div className="space-ui-brand" aria-label="APE">
                <PitecoLogo className="h-9 w-9" />
                <div className="space-ui-brand-copy">
                  <span className="space-ui-brand-title">APE</span>
                  <span className="space-ui-brand-subtitle">Aprenda. Pratique. Conquiste.</span>
                </div>
              </div>
              <AdminButton />
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              {showCurrencyHeader && <CurrencyHeader />}
              {showSecondaryActions && FEATURE_FLAGS.classes_enabled && (
                <Suspense fallback={null}><NotificationBell /></Suspense>
              )}
              {showSecondaryActions && !safeMode && FEATURE_FLAGS.present_inbox_visible && (
                <Suspense fallback={null}><PresentBoxBadge /></Suspense>
              )}
            </div>
          </div>
          {showInstitutionBar && <InstitutionBar />}
        </header>
      )}

      <div className="space-ui-app-frame flex w-full max-w-full min-w-0 flex-1 items-start overflow-x-clip">
        {user && <ApeTabBar />}

        <div className="space-ui-content flex w-full max-w-full min-h-0 min-w-0 flex-1 flex-col overflow-x-clip">
          <main className="space-ui-main w-full max-w-full min-w-0 flex-1 overflow-x-clip">
            {children}
          </main>

          {user && !isFullScreenPage && (
            <div className="space-ui-footer-wrap w-full max-w-full pb-24 md:pb-20">
              <GlobalFooter />
            </div>
          )}
        </div>
      </div>

      {user && secondaryReady && !safeMode && (
        <Suspense fallback={null}>
          <GiftNotificationModal />
          <EconomyInitializer />
          <BrowserCheck />
          <GoogleConnectPrompt />
        </Suspense>
      )}
      {user && secondaryReady && FEATURE_FLAGS.classes_enabled && !safeMode && (
        <Suspense fallback={null}><AnnouncementModal /></Suspense>
      )}

      <div className="fixed bottom-6 right-3 z-50 hidden pointer-events-none sm:block">
        <Badge variant="secondary" className="opacity-70 text-[10px] shadow-sm">
          {formatVersionLabel()}
        </Badge>
      </div>
    </div>
  );
}

export function PrivateShell({ children }: PrivateShellProps) {
  return (
    <EconomyProvider>
      <InstitutionProvider>
        <PrivateShellInner>{children}</PrivateShellInner>
      </InstitutionProvider>
    </EconomyProvider>
  );
}
