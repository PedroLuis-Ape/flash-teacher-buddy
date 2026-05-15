import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PitecoLogo } from "@/features/gamification/components/PitecoLogo";

/**
 * Lightweight top navigation for public/SEO pages.
 * Does not depend on auth/session state.
 */
export function PublicNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="max-w-6xl mx-auto w-full flex h-14 items-center justify-between gap-3 px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <PitecoLogo className="h-8 w-8" />
          <span>APE</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link to="/ingles-para-iniciantes" className="px-3 py-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
            Iniciantes
          </Link>
          <Link to="/atividades-de-ingles" className="px-3 py-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
            Atividades
          </Link>
          <Link to="/flashcards-de-ingles" className="px-3 py-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
            Flashcards
          </Link>
          <Link to="/para-professores" className="px-3 py-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
            Professores
          </Link>
          <Link to="/portal" className="px-3 py-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
            Portal
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">Começar agora</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border/50 mt-16 py-8 text-sm text-muted-foreground">
      <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <p>© {new Date().getFullYear()} APE — Apprenticeship Practice and Enhancement</p>
        <nav className="flex flex-wrap gap-4">
          <Link to="/about" className="hover:text-foreground">Sobre</Link>
          <Link to="/portal" className="hover:text-foreground">Portal</Link>
          <Link to="/auth" className="hover:text-foreground">Entrar</Link>
        </nav>
      </div>
    </footer>
  );
}