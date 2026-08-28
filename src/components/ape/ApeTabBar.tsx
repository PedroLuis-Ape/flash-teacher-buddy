import { Home, Library, Store, User, Target } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { usePerformance } from "@/contexts/PerformanceContext";

// A identidade das abas é o `id`; o rótulo é apenas apresentação traduzida.
const tabs = [
  { id: "home", labelKey: "nav.home", icon: Home, path: "/dashboard" },
  { id: "library", labelKey: "nav.library", icon: Library, path: "/folders" },
  { id: "goals", labelKey: "nav.goals", icon: Target, path: "/goals" },
  { id: "store", labelKey: "nav.store", icon: Store, path: "/store" },
  { id: "profile", labelKey: "nav.profile", icon: User, path: "/profile" },
];

export function ApeTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { settings } = usePerformance();


  const activeIndex = useMemo(() => {
    for (let i = 0; i < tabs.length; i++) {
      const path = tabs[i].path;
      if (location.pathname === path) return i;
      if (path !== "/" && location.pathname.startsWith(path + "/")) return i;
    }
    return -1;
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    return path !== "/" && location.pathname.startsWith(path + "/");
  };

  const isSuperImportRoute =
    location.pathname === "/import/super" ||
    /^\/turmas\/[^/]+\/import\/super\/?$/.test(location.pathname);

  const isActiveStudyRoute =
    location.pathname.endsWith("/study") ||
    location.pathname.endsWith("/mixed-study");

  // Full-screen study sessions already provide their own exit and navigation
  // controls. Keeping the global tab bar mounted steals valuable mobile height
  // and can cover the answer buttons at the bottom of the study surface.
  if (isSuperImportRoute || isActiveStudyRoute) return null;

  return (
    <nav
      className={cn(
        "space-ui-tabbar fixed bottom-0 left-0 right-0 z-50 safe-area-pb",
        "lg:sticky lg:top-[7rem] lg:bottom-auto lg:left-auto lg:right-auto lg:z-30 lg:self-start lg:shrink-0 lg:safe-area-pb-0",
        settings.backdropBlur ? "tab-bar-premium" : "bg-background border-t border-border",
      )}
    >
      <div className="relative flex items-center justify-around h-[4.5rem] max-w-screen-xl mx-auto px-2 md:px-6">
        {settings.tabBarAnimations && activeIndex >= 0 && (
          <div
            className="space-ui-tabbar-indicator absolute top-0 h-[3px] rounded-b-full transition-all duration-300 ease-out"
            style={{
              width: `${100 / tabs.length}%`,
              left: `${(activeIndex / tabs.length) * 100}%`,
            }}
          />
        )}

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);

          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={cn(
                "space-ui-tab relative flex flex-col items-center justify-center gap-1 min-w-[62px] sm:min-w-[76px] h-[3.55rem] rounded-2xl px-2",
                settings.animations && "transition-all duration-200",
                settings.visualFeedback && "active:scale-95",
                active ? "space-ui-tab-active text-foreground" : cn("text-muted-foreground", settings.hoverEffects && "hover:text-foreground"),
              )}
              aria-label={t(tab.labelKey)}
              aria-current={active ? "page" : undefined}
            >
              <div
                className={cn(
                  "relative z-10",
                  settings.animations && "transition-transform duration-200",
                  active && settings.visualFeedback && "scale-110",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                {active && settings.decorativeEffects && (
                  <div className="absolute inset-0 -z-10 bg-primary/30 blur-md rounded-full" />
                )}
              </div>
              <span
                className={cn(
                  "relative z-10 text-[11px] sm:text-xs",
                  settings.animations && "transition-all duration-200",
                  active ? "font-semibold" : "font-normal",
                )}
              >
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
