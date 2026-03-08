/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 Pedro Luis de Oliveira Silva. Todos os direitos reservados.
 * Este software é de uso exclusivo do autor e de seus alunos autorizados.
 * É proibida a cópia, redistribuição ou utilização comercial sem autorização por escrito.
 */

import { ReactNode, useEffect, useState, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { CurrencyHeader } from "@/components/CurrencyHeader";
import { NotificationBell } from "@/components/NotificationBell";
import { AdminButton } from "@/components/AdminButton";
import { ApeTabBar } from "@/components/ape/ApeTabBar";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEconomy } from "@/contexts/EconomyContext";
import { APP_VERSION } from "@/lib/versionManager";
import { Badge } from "@/components/ui/badge";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { InstitutionProvider } from "@/contexts/InstitutionContext";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { useActivityHeartbeat } from "@/hooks/useActivityHeartbeat";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { OfflineIndicator } from "@/components/OfflineIndicator";

// Lazy-load heavy modals and badges (not needed for FCP)
const PresentBoxBadge = lazy(() => import("@/features/gamification/components/PresentBoxBadge").then(m => ({ default: m.PresentBoxBadge })));
const GiftNotificationModal = lazy(() => import("@/components/GiftNotificationModal").then(m => ({ default: m.GiftNotificationModal })));
const AnnouncementModal = lazy(() => import("@/components/AnnouncementModal").then(m => ({ default: m.AnnouncementModal })));

interface GlobalLayoutProps {
  children: ReactNode;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const { refreshBalance } = useEconomy();
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  // Refresh HUD ONLY on initial user login (not on every navigation)
  useEffect(() => {
    if (user) {
      refreshBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Activity heartbeat - tracks when user is active
  useActivityHeartbeat(user?.id);
  
  // Swipe navigation - enabled on mobile
  useSwipeNavigation({ enabled: !!user });
  
  // Don't show header/tabbar on auth pages
  const isAuthPage = location.pathname === '/auth';
  // Full screen pages without footer
  const isFullScreenPage = location.pathname.includes('/study');
  
  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <InstitutionProvider>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col">
        {FEATURE_FLAGS.currency_header_enabled && user && (
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="max-w-6xl mx-auto w-full flex h-12 md:h-14 items-center justify-between gap-2 md:gap-4 px-3 md:px-4 lg:px-8">
                <div className="flex items-center gap-1 md:gap-2">
                  <AppSidebar />
                  <AdminButton />
                </div>
                <div className="flex items-center gap-1.5 md:gap-2">
                  <CurrencyHeader />
                  {FEATURE_FLAGS.classes_enabled && <NotificationBell />}
                  {FEATURE_FLAGS.present_inbox_visible && (
                    <Suspense fallback={null}><PresentBoxBadge /></Suspense>
                  )}
                </div>
              </div>
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
          {user && (
            <Suspense fallback={null}><GiftNotificationModal /></Suspense>
          )}
          {user && FEATURE_FLAGS.classes_enabled && (
            <Suspense fallback={null}><AnnouncementModal /></Suspense>
          )}
          
          {/* Version Badge */}
          <div className="fixed bottom-20 right-4 z-40">
            <Badge variant="secondary" className="opacity-50 hover:opacity-100 transition-opacity text-xs">
              v{APP_VERSION}
            </Badge>
          </div>
        </div>
      </TooltipProvider>
    </InstitutionProvider>
  );
}
