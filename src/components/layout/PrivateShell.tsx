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
import { NotificationBell } from "@/components/NotificationBell";
import { AdminButton } from "@/components/AdminButton";
import { ApeTabBar } from "@/components/ape/ApeTabBar";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { EconomyProvider, useEconomy } from "@/contexts/EconomyContext";
import { formatVersionLabel } from "@/lib/versionManager";
import { Badge } from "@/components/ui/badge";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { InstitutionProvider } from "@/contexts/InstitutionContext";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { useActivityHeartbeat } from "@/hooks/useActivityHeartbeat";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { usePerformance } from "@/contexts/PerformanceContext";
import { InstitutionBar } from "@/components/layout/InstitutionBar";
import { isSafeModeEnabled } from "@/lib/safeMode";
import { AppRecoveryBanner } from "@/components/AppRecoveryBanner";
import { EconomyInitializer } from "@/components/EconomyInitializer";
import { BrowserCheck } from "@/components/BrowserCheck";
import { GoogleConnectPrompt } from "@/features/auth/components/GoogleConnectPrompt";

// Lazy-load heavy modals and badges (not needed for FCP)
const PresentBoxBadge = lazy(() => import("@/features/gamification/components/PresentBoxBadge").then(m => ({ default: m.PresentBoxBadge })));
const GiftNotificationModal = lazy(() => import("@/components/GiftNotificationModal").then(m => ({ default: m.GiftNotificationModal })));
const AnnouncementModal = lazy(() => import("@/components/AnnouncementModal").then(m => ({ default: m.AnnouncementModal })));

interface PrivateShellProps {
  children: ReactNode;
}

function PrivateShellInner({ children }: PrivateShellProps) {
  const location = useLocation();
  const { user } = useAuthUser();
  const { refreshBalance } = useEconomy();
  const { settings: perfSettings } = usePerformance();
  const safeMode = isSafeModeEnabled();

  // Defer secondary work so it never competes with first paint.
  const [secondaryReady, setSecondaryReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (safeMode) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      try { refreshBalance(); } catch { /* noop */ }
      setSecondaryReady(true);
    };
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    const handle = ric
      ? ric(run, { timeout: 2500 })
      : (setTimeout(run, 1500) as unknown as number);
    return () => {
      cancelled = true;
      if (ric && (window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(handle);
      } else {
        clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, safeMode]);

  useActivityHeartbeat(secondaryReady && !safeMode ? user?.id : undefined);
  useSwipeNavigation({ enabled: !!user && !safeMode && FEATURE_FLAGS.swipe_navigation_enabled });

  const isFullScreenPage = location.pathname.includes('/study');
  const isHome = location.pathname === '/dashboard';
  const isGameRoute =
    location.pathname.includes('/study') || location.pathname.includes('/games');
  const showSecondaryActions = !isGameRoute && !isHome;
  const showCurrencyHeader = !isHome && !isGameRoute;
  const showInstitutionBar = isHome;

  return (
    <div className="min-h-screen flex flex-col">
      <AppRecoveryBanner />
      <OfflineIndicator />
      {FEATURE_FLAGS.currency_header_enabled && user && (
        <header className={cn(
          "sticky top-0 z-50 w-full border-b",
          perfSettings.backdropBlur
            ? "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
            : "bg-background"
        )}>
          <div className="max-w-[1600px] mx-auto w-full flex h-12 md:h-14 items-center justify-between gap-2 md:gap-4 px-3 md:px-4 lg:px-8">
            <div className="flex items-center gap-1 md:gap-2">
              <AppSidebar />
              <AdminButton />
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              {showCurrencyHeader && <CurrencyHeader />}
              {showSecondaryActions && FEATURE_FLAGS.classes_enabled && <NotificationBell />}
              {showSecondaryActions && !safeMode && FEATURE_FLAGS.present_inbox_visible && (
                <Suspense fallback={null}><PresentBoxBadge /></Suspense>
              )}
            </div>
          </div>
          {showInstitutionBar && <InstitutionBar />}
        </header>
      )}
      <main className="flex-1">
        {children}
      </main>

      {user && !isFullScreenPage && (
        <div className="pb-24 md:pb-20">
          <GlobalFooter />
        </div>
      )}

      {user && <ApeTabBar />}
      {user && secondaryReady && !safeMode && (
        <Suspense fallback={null}><GiftNotificationModal /></Suspense>
      )}
      {user && secondaryReady && FEATURE_FLAGS.classes_enabled && !safeMode && (
        <Suspense fallback={null}><AnnouncementModal /></Suspense>
      )}

      {/* Side-effect components — only mounted on private routes */}
      <EconomyInitializer />
      <BrowserCheck />
      <GoogleConnectPrompt />

      <div className="fixed bottom-20 md:bottom-6 right-3 z-50 pointer-events-none">
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