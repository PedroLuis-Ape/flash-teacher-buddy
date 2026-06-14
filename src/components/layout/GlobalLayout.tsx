/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 APE Education. Todos os direitos reservados.
 *
 * Phase 5 (Clara Master): GlobalLayout is now a thin router that picks
 * between PublicShell (landing/auth/SEO/portal — no private providers)
 * and PrivateShell (full chrome + Economy + Institution + side-effects).
 * URLs and route nesting are unchanged.
 */
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useFreezeWatchdog } from "@/hooks/useFreezeWatchdog";
import { PublicShell } from "@/components/layout/PublicShell";
import { PrivateShell } from "@/components/layout/PrivateShell";

interface GlobalLayoutProps {
  children: ReactNode;
}

// Exact public paths (no params) — landing, auth, SEO entries.
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

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  // All /portal/* routes are anonymous shareable surfaces.
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return true;
  return false;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const location = useLocation();
  // Global freeze watchdog — mounted once for both shells, no-op when idle.
  useFreezeWatchdog();

  if (isPublicRoute(location.pathname)) {
    return <PublicShell>{children}</PublicShell>;
  }
  return <PrivateShell>{children}</PrivateShell>;
}
