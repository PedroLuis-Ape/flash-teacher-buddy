import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { CurrencyHeader } from "./CurrencyHeader";
import { PresentBoxBadge } from "./PresentBoxBadge";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { TooltipProvider } from "@/components/ui/tooltip";

interface GlobalLayoutProps {
  children: ReactNode;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const location = useLocation();
  
  // Don't show header on auth pages
  const isAuthPage = location.pathname === '/auth' || location.pathname === '/';
  
  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col">
        {FEATURE_FLAGS.currency_header_enabled && (
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-end gap-4 px-4">
              <CurrencyHeader />
              {FEATURE_FLAGS.present_inbox_visible && <PresentBoxBadge />}
            </div>
          </header>
        )}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
