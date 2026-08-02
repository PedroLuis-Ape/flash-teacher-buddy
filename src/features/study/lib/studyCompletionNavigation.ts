export function buildStudyReturnRoute(input: {
  pathname: string;
  resolvedId: string;
  isListRoute: boolean;
  searchParams?: URLSearchParams;
}): string {
  return buildStudyRoute(input, false);
}

/**
 * Route back to the games hub of the current resource, where the study preset
 * (activity, direction, scope) is configured. Keeps the current `mode` so the
 * user lands on the same game's settings.
 */
export function buildStudySettingsRoute(input: {
  pathname: string;
  resolvedId: string;
  isListRoute: boolean;
  searchParams?: URLSearchParams;
}): string {
  return buildStudyRoute(input, true);
}

function buildStudyRoute(input: {
  pathname: string;
  resolvedId: string;
  isListRoute: boolean;
  searchParams?: URLSearchParams;
}, toSettings: boolean): string {
  const { pathname, resolvedId, isListRoute } = input;
  const isPortal = pathname.startsWith("/portal/");

  if (toSettings) {
    const params = new URLSearchParams(input.searchParams ?? undefined);
    for (const key of ["dir", "direction", "from_goal", "from_step"]) {
      params.delete(key);
    }
    const query = params.toString();
    const suffix = query ? `?${query}` : "";
    const base = isListRoute ? `list/${resolvedId}` : `collection/${resolvedId}`;
    return `${isPortal ? "/portal/" : "/"}${base}/games${suffix}`;
  }

  if (isListRoute) {
    if (!isPortal) return `/list/${resolvedId}`;

    const params = new URLSearchParams(input.searchParams ?? undefined);
    for (const key of ["mode", "dir", "direction", "from_goal", "from_step"]) {
      params.delete(key);
    }
    const query = params.toString();
    return `/portal/list/${resolvedId}/games${query ? `?${query}` : ""}`;
  }

  return isPortal
    ? `/portal/collection/${resolvedId}`
    : `/collection/${resolvedId}`;
}
