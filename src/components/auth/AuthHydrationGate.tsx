import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const PUBLIC_PREFIXES = [
  "/auth",
  "/portal",
  "/about",
  "/ingles-para-iniciantes",
  "/atividades-de-ingles",
  "/flashcards-de-ingles",
  "/para-professores",
] as const;

const PUBLIC_EXACT = new Set(["/", "/landing"]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function AuthHydrationGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { status } = useAuth();

  if (isPublicPath(location.pathname)) return <>{children}</>;

  if (status === "initializing") {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-muted-foreground">
        Restaurando sua sessão...
      </div>
    );
  }

  // SessionWatcher performs the redirect. Keeping the private tree unmounted
  // prevents legacy pages from running their own getSession() during the race.
  if (status !== "authenticated") return null;

  return <>{children}</>;
}
