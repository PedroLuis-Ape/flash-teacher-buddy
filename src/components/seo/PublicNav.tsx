import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { PitecoLogo } from "@/features/gamification/components/PitecoLogo";
import { AuthAwareCTA } from "@/components/auth/AuthAwareLink";
import { PublicThemeToggle } from "@/components/seo/PublicThemeToggle";
import { InstallAppButton } from "@/components/InstallAppButton";

const NAV_LINKS = [
  { to: "/", label: "Início" },
  { to: "/ingles-para-iniciantes", label: "Iniciantes" },
  { to: "/atividades-de-ingles", label: "Atividades" },
  { to: "/flashcards-de-ingles", label: "Flashcards" },
  { to: "/para-professores", label: "Professores" },
  { to: "/portal", label: "Portal" },
];

export function PublicNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-3 sm:px-4 lg:px-6">
        <Link to="/" className="flex min-w-0 shrink-0 items-center gap-1.5 text-base font-bold sm:gap-2 sm:text-lg">
          <PitecoLogo className="h-8 w-8 shrink-0" />
          <span className="truncate">APE</span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 text-sm xl:flex 2xl:gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="nav-link-animated whitespace-nowrap rounded-md px-2 py-2 text-muted-foreground hover:text-foreground 2xl:px-3"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <InstallAppButton
            compact
            className="shrink-0 max-[480px]:h-9 max-[480px]:w-9 max-[480px]:gap-0 max-[480px]:px-0 max-[480px]:[&>span]:hidden"
          />
          <PublicThemeToggle />

          <AuthAwareCTA guestMode="login" variant="ghost" size="sm" className="hidden 2xl:inline-flex">
            Entrar
          </AuthAwareCTA>
          <AuthAwareCTA guestMode="signup" size="sm" className="hidden 2xl:inline-flex">
            Começar agora
          </AuthAwareCTA>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 xl:hidden" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(20rem,88vw)]">
              <nav className="mt-8 flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className="nav-link-animated rounded-md px-3 py-3 text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="my-3 h-px bg-border" />
                <AuthAwareCTA guestMode="login" variant="outline" onClick={() => setOpen(false)}>
                  Entrar
                </AuthAwareCTA>
                <AuthAwareCTA guestMode="signup" onClick={() => setOpen(false)}>
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
    <footer className="mt-16 border-t border-border/50 py-8 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-6">
        <p>© {new Date().getFullYear()} APE — Apprentice Practice & Enhancement</p>
        <nav className="flex flex-wrap gap-4">
          <Link to="/about" className="nav-link-animated hover:text-foreground">Sobre</Link>
          <Link to="/portal" className="nav-link-animated hover:text-foreground">Portal</Link>
          <Link to="/auth" className="nav-link-animated hover:text-foreground">Entrar</Link>
        </nav>
      </div>
    </footer>
  );
}
