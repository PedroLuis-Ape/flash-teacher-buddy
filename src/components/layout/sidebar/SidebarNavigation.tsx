import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Gem, Globe, GraduationCap, Home, Library, Search,
  Settings, StickyNote, Store, Target, Trash2, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface SidebarNavigationProps {
  onNavigate: () => void;
}

export function SidebarNavigation({ onNavigate }: SidebarNavigationProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const mainItems = [
    { icon: Home, label: t("tabbar.home", "Início"), path: "/dashboard" },
    { icon: Library, label: t("tabbar.library", "Biblioteca"), path: "/folders" },
    { icon: Target, label: t("tabbar.goals", "Metas"), path: "/goals" },
    { icon: Store, label: t("tabbar.store", "Loja"), path: "/store" },
    { icon: User, label: t("tabbar.profile", "Perfil"), path: "/profile" },
  ];

  const toolItems = [
    { icon: StickyNote, label: t("sidebar.myNotes", "Minhas Notas"), path: "/notes" },
    { icon: Search, label: t("sidebar.search", "Buscar"), path: "/search" },
    { icon: Gem, label: t("sidebar.specials", "Especiais"), path: "/special-cards" },
    { icon: GraduationCap, label: t("sidebar.classes", "Turmas"), path: "/turmas" },
    { icon: Trash2, label: t("sidebar.trash", "Lixeira"), path: "/trash" },
    { icon: Settings, label: t("sidebar.performance", "Desempenho"), path: "/settings/performance" },
    { icon: Globe, label: t("sidebar.landing", "Página inicial"), path: "/landing" },
  ];

  const renderItems = (items: typeof mainItems) => (
    <div className="ape-sidebar-nav">
      {items.map((item) => {
        const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
        return (
          <Button
            key={item.path}
            variant={active ? "secondary" : "ghost"}
            className={cn(
              "min-h-11 w-full justify-start gap-3 rounded-xl px-3",
              active && "bg-primary/15 font-semibold text-primary",
            )}
            onClick={() => {
              onNavigate();
              navigate(item.path);
            }}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("sidebar.mainNav", "Principal")}
        </h3>
        {renderItems(mainItems)}
      </section>
      <Separator />
      <section>
        <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("sidebar.tools", "Ferramentas")}
        </h3>
        {renderItems(toolItems)}
      </section>
    </div>
  );
}
