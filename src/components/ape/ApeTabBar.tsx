import { Home, Library, Store, User, Target } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { usePerformance } from "@/contexts/PerformanceContext";

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
      "fixed bottom-0 left-0 right-0 z-50 safe-area-pb",
      settings.backdropBlur
        ? "tab-bar-premium"
        : "bg-background border-t border-border"
    )}>
      <div className="relative flex items-center justify-around h-16 max-w-screen-xl mx-auto">
        {/* Animated indicator — only when tabBarAnimations enabled */}
        {settings.tabBarAnimations && activeIndex >= 0 && (
          <div 
            className="absolute top-0 h-[3px] bg-primary rounded-b-full transition-all duration-300 ease-out"
            style={{
              width: `${100 / tabs.length}%`,
              left: `${(activeIndex / tabs.length) * 100}%`,
            }}
          />
        )}
        
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 min-w-[64px] h-full",
                settings.animations && "transition-all duration-200",
                settings.visualFeedback && "active:scale-95",
                active ? "text-primary tab-item-active" : cn("text-muted-foreground", settings.hoverEffects && "hover:text-foreground")
              )}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <div className={cn(
                "relative",
                settings.animations && "transition-transform duration-200",
                active && settings.visualFeedback && "scale-110"
              )}>
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                {/* Glow effect — only when decorativeEffects enabled */}
                {active && settings.decorativeEffects && (
                  <div className="absolute inset-0 bg-primary/15 blur-sm rounded-full" />
                )}
              </div>
              <span className={cn(
                "text-xs",
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
