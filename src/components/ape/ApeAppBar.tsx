import { ReactNode } from "react";
import { ArrowLeft, Gift, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EconomyBadge } from "@/components/EconomyBadge";
import { PresentBoxBadge } from "@/components/PresentBoxBadge";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { cn } from "@/lib/utils";

interface ApeAppBarProps {
  title?: string;
  showBack?: boolean;
  backPath?: string;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function ApeAppBar({ 
  title, 
  showBack = false, 
  backPath,
  children,
  className,
  compact = false
}: ApeAppBarProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <header className={cn(
      "sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border",
      className
    )}>
      <div className={cn(
        "container mx-auto px-4 flex items-center justify-between",
        compact ? "h-14" : "h-16"
      )}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              aria-label="Voltar"
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          {title && (
            <h1 className="text-lg font-semibold truncate">
              {title}
            </h1>
          )}
          {children}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/pesquisar')}
            aria-label="Pesquisar usuários"
            title="Pesquisar"
          >
            <Search className="h-5 w-5" />
          </Button>
          {FEATURE_FLAGS.economy_enabled && <EconomyBadge />}
          {FEATURE_FLAGS.present_inbox_visible && <PresentBoxBadge />}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
