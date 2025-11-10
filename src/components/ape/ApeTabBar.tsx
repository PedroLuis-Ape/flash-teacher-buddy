import { Home, BookOpen, Library, Store, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "home", label: "Início", icon: Home, path: "/" },
  { id: "study", label: "Estudar", icon: BookOpen, path: "/folders" },
  { id: "library", label: "Biblioteca", icon: Library, path: "/folders" },
  { id: "store", label: "Loja", icon: Store, path: "/store" },
  { id: "profile", label: "Perfil", icon: User, path: "/profile" },
];

export function ApeTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-screen-xl mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-w-[64px] h-full",
                "transition-colors duration-200",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span className={cn(
                "text-xs",
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
