import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { trackAppNavigation } from "@/lib/safeNavigation";

export function NavigationHistoryTracker() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    trackAppNavigation(
      `${location.pathname}${location.search}${location.hash}`,
      navigationType,
    );
  }, [location.hash, location.pathname, location.search, navigationType]);

  return null;
}
