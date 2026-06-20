import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isProtectedPath } from "@/lib/sessionRouteAccess";

/**
 * SessionWatcher — Route guard only.
 *
 * Phase 1 (Clara Master): the Supabase auth subscription was moved into
 * AuthProvider, so this component is now a pure consumer that reacts to
 * status transitions:
 *   - authenticated + on /auth  → /dashboard
 *   - anonymous + on protected  → /auth
 *
 * It NEVER redirects while status === 'initializing', so the hydration
 * race that previously sent logged-in users to /auth on cold load is gone.
 */
export function SessionWatcher() {
  const navigate = useNavigate();
  const { status } = useAuth();
  const lastStatusRef = useRef(status);

  useEffect(() => {
    if (status === "initializing") return;

    const path = window.location.pathname;

    if (status === "authenticated") {
      if (path.startsWith("/auth") && !path.startsWith("/auth/callback")) {
        navigate("/dashboard", { replace: true });
      }
    } else if (status === "anonymous") {
      if (isProtectedPath(path)) {
        navigate("/auth", { replace: true });
      }
    }

    lastStatusRef.current = status;
  }, [status, navigate]);

  return null;
}
