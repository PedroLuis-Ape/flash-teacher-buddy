export function buildStudyReturnRoute(input: {
  pathname: string;
  resolvedId: string;
  isListRoute: boolean;
  searchParams?: URLSearchParams;
}): string {
  const { pathname, resolvedId, isListRoute } = input;
  const isPortal = pathname.startsWith("/portal/");

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
