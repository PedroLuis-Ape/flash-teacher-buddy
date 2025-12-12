import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { CurrencyHeader } from "./CurrencyHeader";
import { PresentBoxBadge } from "./PresentBoxBadge";
import { NotificationBell } from "./NotificationBell";
import { AdminButton } from "./AdminButton";
import { ApeTabBar } from "./ape/ApeTabBar";
import { GiftNotificationModal } from "./GiftNotificationModal";
import { AnnouncementModal } from "./AnnouncementModal";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEconomy } from "@/contexts/EconomyContext";
import { APP_VERSION } from "@/lib/versionManager";
import { Badge } from "@/components/ui/badge";
import { AppSidebar } from "./AppSidebar";
import { InstitutionProvider } from "@/contexts/InstitutionContext";

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
  
  // Refresh HUD on route change
  useEffect(() => {
    if (user) {
      refreshBalance();
    }
  }, [location.pathname, user, refreshBalance]);
  
  // Don't show header/tabbar on auth pages
  const isAuthPage = location.pathname === '/auth';
  
  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <InstitutionProvider>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col">
          {FEATURE_FLAGS.currency_header_enabled && user && (
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="max-w-6xl mx-auto w-full flex h-14 items-center justify-between gap-4 px-4 lg:px-8">
                <div className="flex items-center gap-2">
                  <AppSidebar />
                  <AdminButton />
                </div>
                <div className="flex items-center gap-2">
                  <CurrencyHeader />
                  {FEATURE_FLAGS.classes_enabled && <NotificationBell />}
                  {FEATURE_FLAGS.present_inbox_visible && <PresentBoxBadge />}
                </div>
              </div>
            </header>
          )}
          <main className="flex-1 pb-16">
            {children}
          </main>
          {user && <ApeTabBar />}
          {user && <GiftNotificationModal />}
          {user && FEATURE_FLAGS.classes_enabled && <AnnouncementModal />}
          
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
