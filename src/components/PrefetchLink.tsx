/**
 * PrefetchLink — intent-based route chunk prefetch.
 *
 * Phase 6 (Clara Master): replaces eager `prefetchCommonRoutes()` with a
 * Link wrapper that warms the destination chunk only when the user
 * signals intent — pointer enter, focus, or first touch. Dedup, Safe
 * Mode, saveData, slow connections and low-memory/CPU devices are all
 * honoured inside `prefetchRoute`.
 *
 * Drop-in for react-router's `Link`. Existing `Link` usages keep working;
 * adopt incrementally where prefetch matters.
 */
import { forwardRef, useCallback } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { prefetchRoute } from "@/lib/routePrefetch";

function resolvePath(to: LinkProps["to"]): string | null {
  if (typeof to === "string") return to;
  if (to && typeof to === "object" && "pathname" in to && to.pathname) {
    return to.pathname;
  }
  return null;
}

export const PrefetchLink = forwardRef<HTMLAnchorElement, LinkProps>(
  function PrefetchLink({ to, onPointerEnter, onFocus, onTouchStart, ...rest }, ref) {
    const path = resolvePath(to);

    const triggerPrefetch = useCallback(() => {
      if (!path) return;
      try { prefetchRoute(path); } catch { /* noop */ }
    }, [path]);

    return (
      <Link
        ref={ref}
        to={to}
        onPointerEnter={(e) => { triggerPrefetch(); onPointerEnter?.(e); }}
        onFocus={(e) => { triggerPrefetch(); onFocus?.(e); }}
        onTouchStart={(e) => { triggerPrefetch(); onTouchStart?.(e); }}
        {...rest}
      />
    );
  },
);