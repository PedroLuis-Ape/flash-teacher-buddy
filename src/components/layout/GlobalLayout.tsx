/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 APE Education. Todos os direitos reservados.
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
import { useEconomy } from "@/contexts/EconomyContext";
import { formatVersionLabel } from "@/lib/versionManager";
import { Badge } from "@/components/ui/badge";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { InstitutionProvider } from "@/contexts/InstitutionContext";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { useActivityHeartbeat } from "@/hooks/useActivityHeartbeat";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { usePerformance } from "@/contexts/PerformanceContext";
import { prefetchCommonRoutes } from "@/lib/routePrefetch";
import { InstitutionBar } from "@/components/layout/InstitutionBar";
import { useFreezeWatchdog } from "@/hooks/useFreezeWatchdog";
import { isSafeModeEnabled } from "@/lib/safeMode";
import { AppRecoveryBanner } from "@/components/AppRecoveryBanner";

// Lazy-load heavy modals and badges (not needed for FCP)
const PresentBoxBadge = lazy(() => import("@/features/gamification/components/PresentBoxBadge").then(m => ({ default: m.PresentBoxBadge })));
const GiftNotificationModal = lazy(() => import("@/components/GiftNotificationModal").then(m => ({ default: m.GiftNotificationModal })));
const AnnouncementModal = lazy(() => import("@/components/AnnouncementModal").then(m => ({ default: m.AnnouncementModal })));

interface GlobalLayoutProps {
  children: ReactNode;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const location = useLocation();
  const { user } = useAuthUser();
  const { refreshBalance } = useEconomy();
  const { settings: perfSettings } = usePerformance();
  // Global freeze watchdog — mounted once, no-op when nothing freezes.
  useFreezeWatchdog();
  const safeMode = isSafeModeEnabled();

  // ── Defer secondary work so it never competes with first paint. ──
  // Modais, prefetch, refreshBalance e heartbeat só ligam alguns segundos
  // depois que a tela já está interativa. Se requestIdleCallback estiver
  // disponível, usamos; caso contrário, setTimeout serve de fallback.
  const [secondaryReady, setSecondaryReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (safeMode) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      // Prefetch and balance refresh — both opportunistic, never blocking.
      try { refreshBalance(); } catch { /* noop */ }
      try { prefetchCommonRoutes(); } catch { /* noop */ }
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

  // Activity heartbeat — only after the page is interactive to avoid
  // competing with the initial Home load.
  useActivityHeartbeat(secondaryReady && !safeMode ? user?.id : undefined);
  
  // Swipe navigation - enabled on mobile (respects feature flag)
  useSwipeNavigation({ enabled: !!user && !safeMode && FEATURE_FLAGS.swipe_navigation_enabled });
  
  // Don't show header/tabbar on auth pages
  const isAuthPage = location.pathname === '/auth';
  // Public landing page — keep it free of internal app chrome (header/tabbar/footer)
  // even when the user is logged in. The landing must look the same for visitors
  // and authenticated users. Includes /landing (always-public alias of /).
  const isPublicLanding =
    location.pathname === '/' || location.pathname === '/landing';
  // Full screen pages without footer
  const isFullScreenPage = location.pathname.includes('/study');

  // Top bar contextual variants — keeps the bar light on internal pages and minimal in games.
  const isHome = location.pathname === '/dashboard';
  const isGameRoute =
    location.pathname.includes('/study') || location.pathname.includes('/games');
  // Hide secondary actions (notifications, presents) inside game / study to avoid distractions.
  // On Home we also hide them: the top bar must stay minimal (menu + compact PTS only),
  // since notifications/presents are reachable via sidebar / store tab and PTS already
  // appears in the stats card. This removes the triple-layer clutter on mobile Home.
  const showSecondaryActions = !isGameRoute && !isHome;
  // CurrencyHeader on Home is redundant (PTS is shown in the stats grid). Hide it there
  // to leave a clean Linha 1: [menu] ............... [admin?]. Also hide inside games
  // for full-focus mode.
  const showCurrencyHeader = !isHome && !isGameRoute;
  // Institution bar only appears on Home; internal pages and games stay clean.
  const showInstitutionBar = isHome;
  
  if (isAuthPage || isPublicLanding) {
    return (
      <>
        {children}
        {/* Version Badge — also visible on auth so users can report the build */}
        <div className="fixed bottom-3 right-3 z-50 pointer-events-none">
          <Badge variant="secondary" className="opacity-70 text-[10px] shadow-sm">
            {formatVersionLabel()}
          </Badge>
        </div>
      </>
    );
  }

  return (
    <InstitutionProvider>
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
          
          {/* Global Footer - hidden on study pages and for non-logged users */}
          {user && !isFullScreenPage && (
            <div className="pb-24 md:pb-20">
              <GlobalFooter />
            </div>
          )}
          
          {user && <ApeTabBar />}
          {user && secondaryReady && (
            !safeMode && <Suspense fallback={null}><GiftNotificationModal /></Suspense>
          )}
          {user && secondaryReady && FEATURE_FLAGS.classes_enabled && (
            !safeMode && <Suspense fallback={null}><AnnouncementModal /></Suspense>
          )}
          
          {/* Version Badge — higher opacity so users can see the live build */}
          <div className="fixed bottom-20 md:bottom-6 right-3 z-50 pointer-events-none">
            <Badge variant="secondary" className="opacity-70 text-[10px] shadow-sm">
              {formatVersionLabel()}
            </Badge>
          </div>
      </div>
    </InstitutionProvider>
  );
}
