import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useFreezeWatchdog } from "@/hooks/useFreezeWatchdog";
import { useAuthUser } from "@/hooks/useAuthUser";
import { PublicShell } from "@/components/layout/PublicShell";
import { PrivateShell } from "@/components/layout/PrivateShell";

interface GlobalLayoutProps {
  children: ReactNode;
}

const PUBLIC_EXACT = new Set<string>([
  "/",
  "/landing",
  "/auth",
  "/auth/callback",
  "/ingles-para-iniciantes",
  "/atividades-de-ingles",
  "/flashcards-de-ingles",
  "/para-professores",
]);

function isClassSharePath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "turmas" || parts.length !== 2) return false;
  return parts[1] !== "professor" && parts[1] !== "aluno";
}

function isPublicRoute(pathname: string, isGuest: boolean): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return true;
  if (isGuest && isClassSharePath(pathname)) return true;
  return false;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const location = useLocation();
  const { user } = useAuthUser();
  useFreezeWatchdog();

  if (isPublicRoute(location.pathname, !user)) {
    return <PublicShell>{children}</PublicShell>;
  }

  return <PrivateShell>{children}</PrivateShell>;
}
