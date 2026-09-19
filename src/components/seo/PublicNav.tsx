import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { PitecoLogo } from "@/features/gamification/components/PitecoLogo";
import { AuthAwareCTA } from "@/components/auth/AuthAwareLink";
import { PublicThemeToggle } from "@/components/seo/PublicThemeToggle";
import { InstallAppButton } from "@/components/InstallAppButton";
import { getEditorialFamilyRoutes, getEditorialHomePath, type EditorialLocale } from "@/content/public/editorialMaster";

const NAV_COPY: Record<EditorialLocale, { home: string; features: string; flashcards: string; teachers: string; methodology: string; portal: string; login: string; signup: string; menu: string }> = {
  "pt-BR": { home: "Início", features: "Recursos", flashcards: "Flashcards", teachers: "Professores", methodology: "Metodologia", portal: "Portal", login: "Entrar", signup: "Começar agora", menu: "Abrir menu" },
  en: { home: "Home", features: "Features", flashcards: "Flashcards", teachers: "Teachers", methodology: "Methodology", portal: "Portal", login: "Sign in", signup: "Get started", menu: "Open menu" },
  es: { home: "Inicio", features: "Recursos", flashcards: "Flashcards", teachers: "Profesores", methodology: "Metodología", portal: "Portal", login: "Entrar", signup: "Empezar", menu: "Abrir menú" },
  fr: { home: "Accueil", features: "Ressources", flashcards: "Flashcards", teachers: "Enseignants", methodology: "Méthodologie", portal: "Portail", login: "Se connecter", signup: "Commencer", menu: "Ouvrir le menu" },
  it: { home: "Home", features: "Risorse", flashcards: "Flashcard", teachers: "Insegnanti", methodology: "Metodologia", portal: "Portale", login: "Accedi", signup: "Inizia ora", menu: "Apri menu" },
  de: { home: "Startseite", features: "Funktionen", flashcards: "Lernkarten", teachers: "Lehrkräfte", methodology: "Methodik", portal: "Portal", login: "Anmelden", signup: "Jetzt starten", menu: "Menü öffnen" },
};

function getNavLinks(locale: EditorialLocale) {
  const routes = getEditorialFamilyRoutes();
  const copy = NAV_COPY[locale];
  return [
    { to: getEditorialHomePath(locale), label: copy.home },
    { to: routes.features[locale], label: copy.features },
    { to: routes.flashcards[locale], label: copy.flashcards },
    { to: routes.teachers[locale], label: copy.teachers },
    { to: routes.methodology[locale], label: copy.methodology },
    { to: "/portal", label: copy.portal },
  ];
}

export function PublicNav({ compact = false, locale = "pt-BR" }: { compact?: boolean; locale?: EditorialLocale }) {
  const [open, setOpen] = useState(false);
  const copy = NAV_COPY[locale];
  const navLinks = getNavLinks(locale);
  const links = compact ? navLinks.filter(link => [navLinks[1].to, navLinks[3].to, "/portal"].includes(link.to)) : navLinks;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-3 sm:px-4 lg:px-6">
        <Link to="/" className="flex min-w-0 shrink-0 items-center gap-1.5 text-base font-bold sm:gap-2 sm:text-lg">
          <PitecoLogo className="h-8 w-8 shrink-0" />
          <span className="truncate">APE</span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 text-sm xl:flex 2xl:gap-1">
          {links.map((link) => (
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
          {!compact && <InstallAppButton
            compact
            className="shrink-0 max-[480px]:h-9 max-[480px]:w-9 max-[480px]:gap-0 max-[480px]:px-0 max-[480px]:[&>span]:hidden"
          />}
          <PublicThemeToggle />

          <AuthAwareCTA guestMode="login" variant="ghost" size="sm" className={compact ? "inline-flex" : "hidden 2xl:inline-flex"}>
            {copy.login}
          </AuthAwareCTA>
          {!compact && <AuthAwareCTA guestMode="signup" size="sm" className="hidden 2xl:inline-flex">
            {copy.signup}
          </AuthAwareCTA>}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 xl:hidden" aria-label={copy.menu}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(20rem,88vw)]">
              <nav className="mt-8 flex flex-col gap-1">
                {links.map((link) => (
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
                  {copy.login}
                </AuthAwareCTA>
                <AuthAwareCTA guestMode="signup" onClick={() => setOpen(false)}>
                  {copy.signup}
                </AuthAwareCTA>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter({ locale = "pt-BR" }: { locale?: EditorialLocale }) {
  const copy = NAV_COPY[locale];
  const routes = getEditorialFamilyRoutes();
  const about = routes.about[locale];
  const methodology = routes.methodology[locale];
  const evidence = routes.evidence[locale];
  const official = routes.official[locale];
  return (
    <footer className="mt-16 border-t border-border/50 py-8 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-6">
        <p>© {new Date().getFullYear()} APE — Apprentice Practice & Enhancement</p>
        <nav className="flex flex-wrap gap-4">
          <Link to={about} className="nav-link-animated hover:text-foreground">{locale === "en" ? "About" : locale === "pt-BR" ? "Sobre" : "About"}</Link>
          <Link to={methodology} className="nav-link-animated hover:text-foreground">{copy.methodology}</Link>
          <Link to={evidence} className="nav-link-animated hover:text-foreground">{locale === "en" ? "Evidence" : locale === "pt-BR" ? "Evidências" : "Evidence"}</Link>
          <Link to={official} className="nav-link-animated hover:text-foreground">{locale === "en" ? "Official source" : locale === "pt-BR" ? "Fonte oficial" : "Official source"}</Link>
          <Link to="/portal" className="nav-link-animated hover:text-foreground">{copy.portal}</Link>
          <Link to="/auth" className="nav-link-animated hover:text-foreground">{copy.login}</Link>
        </nav>
      </div>
    </footer>
  );
}
