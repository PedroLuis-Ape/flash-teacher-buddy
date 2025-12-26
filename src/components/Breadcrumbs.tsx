import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

// Route name mapping for auto-generated breadcrumbs
const routeNameMap: Record<string, string> = {
  folders: "Biblioteca",
  folder: "Pasta",
  list: "Lista",
  goals: "Metas",
  profile: "Perfil",
  store: "Loja",
  turmas: "Turmas",
  "turmas-professor": "Minhas Turmas",
  "turmas-aluno": "Participando",
  notes: "Notas",
  search: "Busca",
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const location = useLocation();
  
  // Auto-generate breadcrumbs from path if items not provided
  const breadcrumbs: BreadcrumbItem[] = items || (() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [];
    
    let currentPath = '';
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      currentPath += `/${part}`;
      
      // Skip UUIDs
      if (/^[0-9a-f-]{36}$/i.test(part)) continue;
      
      const label = routeNameMap[part] || part.charAt(0).toUpperCase() + part.slice(1);
      crumbs.push({
        label,
        path: i < pathParts.length - 1 ? currentPath : undefined,
      });
    }
    
    return crumbs;
  })();

  if (breadcrumbs.length === 0) return null;

  return (
    <nav 
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto",
        "animate-fade-in",
        className
      )}
    >
      <Link 
        to="/" 
        className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0 p-1 -ml-1 rounded-md hover:bg-accent"
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Início</span>
      </Link>
      
      {breadcrumbs.map((item, index) => (
        <div key={index} className="flex items-center gap-1 min-w-0">
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
          {item.path ? (
            <Link
              to={item.path}
              className="hover:text-foreground transition-colors truncate max-w-[120px] sm:max-w-[200px] p-1 rounded-md hover:bg-accent"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium truncate max-w-[120px] sm:max-w-[200px]">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
