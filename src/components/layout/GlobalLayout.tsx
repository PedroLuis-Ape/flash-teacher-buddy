import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useFreezeWatchdog } from "@/hooks/useFreezeWatchdog";
import { useAuthUser } from "@/hooks/useAuthUser";
import { PublicShell } from "@/components/layout/PublicShell";
import { PrivateShell } from "@/components/layout/PrivateShell";
import { PortalHistorySyncAgent } from "@/components/portal/PortalHistorySyncAgent";
import { MixedModeRecommendationBubble } from "@/features/study/components/MixedModeRecommendationBubble";

interface GlobalLayoutProps {
  children: ReactNode;
}

const PUBLIC_EXACT = new Set<string>([
  "/",
  "/landing",
  "/auth",
  "/auth/callback",
  "/about",
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

function isInternationalPublicPath(pathname: string): boolean {
  return pathname === "/pt-br"
    || pathname.startsWith("/pt-br/")
    || pathname === "/en"
    || pathname.startsWith("/en/");
}

function isPublicRoute(pathname: string, isGuest: boolean): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (isInternationalPublicPath(pathname)) return true;
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
      <MixedModeRecommendationBubble />
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
