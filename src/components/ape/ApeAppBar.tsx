import { ReactNode } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EconomyBadge } from "@/features/gamification/components/EconomyBadge";
import { PresentBoxBadge } from "@/features/gamification/components/PresentBoxBadge";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { cn } from "@/lib/utils";

interface ApeAppBarProps {
  title?: string;
  showBack?: boolean;
  backPath?: string;
  onBack?: () => void;
  rightContent?: ReactNode;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  /**
   * Visual/behavior variant. Defaults to "internal".
   * - "home":     Home dashboard (no back, optional ações).
   * - "internal": Standard internal page (back habilitado por padrão).
   * - "game":     Study/game (top bar mínima, sem ações secundárias).
   * - "default":  Comportamento legado, controlado pelas props.
   */
  variant?: "home" | "internal" | "game" | "default";
  /** Show the search button (default: false — opt-in) */
  showSearch?: boolean;
  /** Show the economy badge (default: false — opt-in) */
  showEconomy?: boolean;
  /** Show the present/gift badge (default: false — opt-in) */
  showGift?: boolean;
  /** Show the theme toggle (default: false — opt-in) */
  showThemeToggle?: boolean;
}

export function ApeAppBar({ 
  title, 
  showBack,
  backPath,
  onBack,
  rightContent,
  children,
  className,
  compact = false,
  variant = "internal",
  showSearch = false,
  showEconomy = false,
  showGift = false,
  showThemeToggle = false,
}: ApeAppBarProps) {
  const navigate = useNavigate();

  // Variant-driven defaults — keep behavior previsível por tela.
  // Cada variant define um padrão; props explícitas sempre vencem.
  const isGame = variant === "game";
  const resolvedShowBack =
    typeof showBack === "boolean"
      ? showBack
      : variant === "internal" || variant === "game";
  // Game force-disables ações secundárias para foco total.
  const resolvedShowSearch = isGame ? false : showSearch;
  const resolvedShowEconomy = isGame ? false : showEconomy;
  const resolvedShowGift = isGame ? false : showGift;
  const resolvedShowThemeToggle = isGame ? false : showThemeToggle;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <header className={cn(
      "space-ui-pagebar sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border",
      className
    )}>
      <div className={cn(
        "container mx-auto px-3 sm:px-4 flex items-center justify-between gap-2",
        compact || isGame ? "h-14" : "h-14 sm:h-16"
      )}>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
          {resolvedShowBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label="Voltar"
            className="shrink-0 h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          )}
          {title && (
            <h1 className="text-base sm:text-lg font-semibold truncate">
              {title}
            </h1>
          )}
          {children}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {rightContent}
          {resolvedShowSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/search')}
              aria-label="Pesquisar usuários"
              title="Pesquisar"
              className="h-10 w-10"
            >
              <Search className="h-5 w-5" />
            </Button>
          )}
          {resolvedShowEconomy && FEATURE_FLAGS.economy_enabled && <EconomyBadge />}
          {resolvedShowGift && FEATURE_FLAGS.present_inbox_visible && <PresentBoxBadge />}
          {resolvedShowThemeToggle && <ThemeToggle />}
        </div>
      </div>
    </header>
  );
}
