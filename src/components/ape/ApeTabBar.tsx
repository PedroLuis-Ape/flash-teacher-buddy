import { Home, Library, Store, User, Target } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

const tabs = [
  { id: "home", label: "Início", icon: Home, path: "/" },
  { id: "library", label: "Biblioteca", icon: Library, path: "/folders" },
  { id: "goals", label: "Metas", icon: Target, path: "/goals" },
  { id: "store", label: "Loja", icon: Store, path: "/store" },
  { id: "profile", label: "Perfil", icon: User, path: "/profile" },
];

export function ApeTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeIndex = useMemo(() => {
    for (let i = 0; i < tabs.length; i++) {
      const path = tabs[i].path;
      if (path === "/" && location.pathname === "/") return i;
      if (path !== "/" && location.pathname.startsWith(path)) return i;
    }
    return -1;
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border safe-area-pb">
      <div className="relative flex items-center justify-around h-16 max-w-screen-xl mx-auto">
        {/* Animated indicator */}
        {activeIndex >= 0 && (
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
                "transition-all duration-200",
                "active:scale-95",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <div className={cn(
                "relative transition-transform duration-200",
                active && "scale-110"
              )}>
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                {active && (
                  <div className="absolute inset-0 bg-primary/20 blur-md rounded-full animate-pulse" />
                )}
              </div>
              <span className={cn(
                "text-xs transition-all duration-200",
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
