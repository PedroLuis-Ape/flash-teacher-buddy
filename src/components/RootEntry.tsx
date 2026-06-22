import { Navigate } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import LandingPage from "@/pages/LandingPage";
import { LandingHelpOverlay } from "@/components/landing/LandingHelpPreview";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

/**
 * Smart "/" gate:
 *  - logged-in user  → redirect to /dashboard
 *  - logged-out user → render public LandingPage with the first-visit help overlay
 *
 * Uses useAuthUser, which already provides optimistic session from
 * localStorage (Supabase-managed), so there is no extra flash when a
 * returning user opens the site.
 */
export default function RootEntry() {
  const { user, isLoading } = useAuthUser();

  if (isLoading) {
    return <LoadingSpinner message="Carregando..." variant="skeleton" />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <LandingPage />
      <LandingHelpOverlay />
    </>
  );
}
