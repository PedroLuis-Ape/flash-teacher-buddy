import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useFreezeWatchdog } from "@/hooks/useFreezeWatchdog";
import { useAuthUser } from "@/hooks/useAuthUser";
import { PublicShell } from "@/components/layout/PublicShell";
import { PrivateShell } from "@/components/layout/PrivateShell";
import { PortalHistorySyncAgent } from "@/components/portal/PortalHistorySyncAgent";
import { PublicClassPlayLauncher } from "@/features/classroom/components/PublicClassPlayLauncher";

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
  const navigate = useNavigate();
  const { user } = useAuthUser();
  useFreezeWatchdog();

  const content = isPublicRoute(location.pathname, !user)
    ? <PublicShell>{children}</PublicShell>
    : <PrivateShell>{children}</PrivateShell>;

  return (
    <>
      <PortalHistorySyncAgent />
      {content}
      <PublicClassPlayLauncher />
      {location.pathname === "/import" && user && (
        <div className="fixed bottom-24 right-4 z-50 sm:bottom-8 sm:right-8">
          <Button
            size="lg"
            className="rounded-full shadow-lg"
            onClick={() => navigate("/import/super")}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Super Importador Global
          </Button>
        </div>
      )}
    </>
  );
}
