import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { trackAppNavigation } from "@/lib/safeNavigation";

export function NavigationHistoryTracker() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const initialized = useRef(false);

  useEffect(() => {
    trackAppNavigation(
      `${location.pathname}${location.search}${location.hash}`,
      initialized.current ? navigationType : "RESET",
    );
    initialized.current = true;
  }, [location.hash, location.pathname, location.search, navigationType]);

  return null;
}
