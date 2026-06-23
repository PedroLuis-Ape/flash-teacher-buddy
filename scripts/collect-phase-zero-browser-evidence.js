(() => {
  const now = new Date().toISOString();
  const navigation = performance.getEntriesByType("navigation")[0];
  const paints = Object.fromEntries(
    performance.getEntriesByType("paint").map((entry) => [entry.name, Math.round(entry.startTime)]),
  );

  const sanitizeResource = (value) => {
    try {
      const url = new URL(value, window.location.href);
      return `${url.origin}${url.pathname}`;
    } catch {
      return null;
    }
  };

  const resources = performance
    .getEntriesByType("resource")
    .map((entry) => sanitizeResource(entry.name))
    .filter(Boolean);

  const supabaseResources = [...new Set(resources.filter((url) =>
    url.includes(".supabase.co/") ||
    url.includes("/auth/v1/") ||
    url.includes("/rest/v1/") ||
    url.includes("/storage/v1/") ||
    url.includes("/functions/v1/"),
  ))];

  const projectRefs = [...new Set(supabaseResources.flatMap((value) => {
    try {
      const host = new URL(value).hostname;
      const match = host.match(/^([a-z]{20})\.supabase\.co$/);
      return match ? [match[1]] : [];
    } catch {
      return [];
    }
  }))];

  const serviceFor = (value) => {
    if (value.includes("/auth/v1/")) return "auth";
    if (value.includes("/rest/v1/rpc/")) return "rpc";
    if (value.includes("/rest/v1/")) return "rest";
    if (value.includes("/storage/v1/")) return "storage";
    if (value.includes("/functions/v1/")) return "functions";
    return "other";
  };

  const services = Object.fromEntries(
    ["auth", "rest", "rpc", "storage", "functions"].map((service) => [
      service,
      supabaseResources.filter((value) => serviceFor(value) === service),
    ]),
  );

  const evidence = {
    schema: "app-piteco-browser-evidence",
    version: "1.0",
    captured_at: now,
    location: {
      origin: window.location.origin,
      pathname: window.location.pathname,
      search_present: Boolean(window.location.search),
      hash_present: Boolean(window.location.hash),
    },
    runtime: {
      user_agent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      online: navigator.onLine,
      navigation: navigation ? {
        type: navigation.type,
        ttfb_ms: Math.round(navigation.responseStart),
        dom_content_loaded_ms: Math.round(navigation.domContentLoadedEventEnd),
        load_ms: Math.round(navigation.loadEventEnd),
        transfer_size: navigation.transferSize,
      } : null,
      paints,
    },
    backend: {
      observed_project_refs: projectRefs,
      services,
    },
    privacy: {
      cookies_collected: false,
      headers_collected: false,
      query_values_collected: false,
      storage_values_collected: false,
    },
  };

  const serialized = JSON.stringify(evidence, null, 2);
  console.log("App Piteco — evidência sanitizada da Fase 0");
  console.log(serialized);
  if (typeof copy === "function") copy(serialized);
  return evidence;
})();
