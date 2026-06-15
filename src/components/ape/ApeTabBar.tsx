import { Home, Library, Store, User, Target } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { usePerformance } from "@/contexts/PerformanceContext";
import "@/styles/space-ui-widgets.css";
import "@/styles/space-ui-reference-match.css";
import "@/styles/space-ui-glitter.css";
import "@/styles/space-ui-piteco-fullbody.css";

const tabs = [
  { id: "home", label: "Início", icon: Home, path: "/dashboard" },
  { id: "library", label: "Biblioteca", icon: Library, path: "/folders" },
  { id: "goals", label: "Metas", icon: Target, path: "/goals" },
  { id: "store", label: "Loja", icon: Store, path: "/store" },
  { id: "profile", label: "Perfil", icon: User, path: "/profile" },
];

export function ApeTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
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

  return (
    <nav className={cn(
      "space-ui-tabbar fixed bottom-0 left-0 right-0 z-50 safe-area-pb",
      settings.backdropBlur
        ? "tab-bar-premium"
        : "bg-background border-t border-border"
    )}>
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
                active ? "space-ui-tab-active text-primary" : cn("text-muted-foreground", settings.hoverEffects && "hover:text-foreground")
              )}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <div className={cn(
                "relative z-10",
                settings.animations && "transition-transform duration-200",
                active && settings.visualFeedback && "scale-110"
              )}>
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                {active && settings.decorativeEffects && (
                  <div className="absolute inset-0 -z-10 bg-primary/30 blur-md rounded-full" />
                )}
              </div>
              <span className={cn(
                "relative z-10 text-[11px] sm:text-xs",
                settings.animations && "transition-all duration-200",
                active ? "font-semibold" : "font-normal"
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
