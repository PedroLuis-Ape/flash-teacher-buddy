import { ArrowLeft, Home } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PitecoLogo } from '@/features/gamification/components/PitecoLogo';
import { PublicThemeToggle } from '@/components/seo/PublicThemeToggle';
import { safeGoBack } from "@/lib/safeNavigation";

interface PublicPageHeaderProps {
  title: string;
  fallbackPath?: string;
}

/**
 * Cabeçalho reutilizável para páginas públicas. O retorno usa o histórico
 * interno do app e cai para a rota informada em acessos diretos.
 */
export function PublicPageHeader({ title, fallbackPath = '/' }: PublicPageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    safeGoBack(navigate, { fallbackRoute: fallbackPath });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:h-16 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="h-10 shrink-0 gap-2 px-2 sm:px-3"
          aria-label="Voltar para a página anterior"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>

        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="icon" className="h-10 w-10" title="Página inicial">
            <Link to="/" aria-label="Ir para a página inicial">
              <span className="relative flex h-8 w-8 items-center justify-center">
                <PitecoLogo className="h-8 w-8" />
                <Home className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-background p-0.5" />
              </span>
            </Link>
          </Button>
          <PublicThemeToggle />
        </div>
      </div>
    </header>
  );
}
