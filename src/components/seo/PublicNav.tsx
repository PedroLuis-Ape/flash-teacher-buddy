import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { PitecoLogo } from "@/features/gamification/components/PitecoLogo";
import { AuthAwareCTA } from "@/components/auth/AuthAwareLink";

const NAV_LINKS = [
  { to: "/", label: "Início" },
  { to: "/ingles-para-iniciantes", label: "Iniciantes" },
  { to: "/atividades-de-ingles", label: "Atividades" },
  { to: "/flashcards-de-ingles", label: "Flashcards" },
  { to: "/para-professores", label: "Professores" },
  { to: "/portal", label: "Portal" },
];

/**
 * Lightweight top navigation for public/SEO pages.
 * Does not depend on auth/session state.
 */
export function PublicNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="max-w-6xl mx-auto w-full flex h-14 items-center justify-between gap-3 px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <PitecoLogo className="h-8 w-8" />
          <span>APE</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="nav-link-animated px-3 py-2 rounded-md text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <AuthAwareCTA variant="ghost" size="sm" className="hidden sm:inline-flex">
            Entrar
          </AuthAwareCTA>
          <AuthAwareCTA size="sm" className="hidden sm:inline-flex">
            Começar agora
          </AuthAwareCTA>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <nav className="flex flex-col gap-1 mt-8">
                {NAV_LINKS.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="nav-link-animated px-3 py-3 rounded-md text-foreground"
                  >
                    {l.label}
                  </Link>
                ))}
                <div className="h-px bg-border my-3" />
                <AuthAwareCTA variant="outline" onClick={() => setOpen(false)}>
                  Entrar
                </AuthAwareCTA>
                <AuthAwareCTA onClick={() => setOpen(false)}>
                  Começar agora
                </AuthAwareCTA>
              </nav>
            </SheetContent>
          </Sheet>
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
          <Link to="/about" className="nav-link-animated hover:text-foreground">Sobre</Link>
          <Link to="/portal" className="nav-link-animated hover:text-foreground">Portal</Link>
          <Link to="/auth" className="nav-link-animated hover:text-foreground">Entrar</Link>
        </nav>
      </div>
    </footer>
  );
}