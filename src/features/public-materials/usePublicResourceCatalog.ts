import { useQuery } from "@tanstack/react-query";
import { publicSupabase } from "@/integrations/supabase/publicClient";

export interface PublicResourceCatalogItem {
  slug: string;
  title: string;
  folder_title: string | null;
  level: string | null;
  theme: string | null;
  resource_type: string | null;
  summary: string | null;
  card_count: number;
  author_name: string;
  author_slug: string | null;
  canonical_path: string | null;
  play_path: string;
}

export interface PublicResourceCatalogFacet {
  value: string;
  count: number;
}

export interface PublicResourceCatalog {
  items: PublicResourceCatalogItem[];
  total: number;
  has_more: boolean;
  facets: {
    levels: PublicResourceCatalogFacet[];
    themes: PublicResourceCatalogFacet[];
    resource_types: PublicResourceCatalogFacet[];
  };
}

export interface PublicResourceCatalogParams {
  locale: string;
  q?: string;
  level?: string;
  theme?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

const EMPTY_CATALOG: PublicResourceCatalog = {
  items: [],
  total: 0,
  has_more: false,
  facets: { levels: [], themes: [], resource_types: [] },
};

type CatalogRpc = (
  name: "list_public_resources_v1",
  args: {
    _locale: string;
    _q: string | null;
    _level: string | null;
    _theme: string | null;
    _resource_type: string | null;
    _limit: number;
    _offset: number;
  },
) => Promise<{ data: unknown; error: unknown }>;

export const publicResourceCatalogKey = ({
  locale,
  q = "",
  level = "",
  theme = "",
  type = "",
  limit = 24,
  offset = 0,
}: PublicResourceCatalogParams) =>
  ["public", "catalog", locale, q, level, theme, type, limit, offset] as const;

export async function fetchPublicResourceCatalog({
  locale,
  q = "",
  level = "",
  theme = "",
  type = "",
  limit = 24,
  offset = 0,
}: PublicResourceCatalogParams): Promise<PublicResourceCatalog> {
  const rpc = publicSupabase.rpc.bind(publicSupabase) as unknown as CatalogRpc;
  const { data, error } = await rpc("list_public_resources_v1", {
    _locale: locale,
    _q: q || null,
    _level: level || null,
    _theme: theme || null,
    _resource_type: type || null,
    _limit: limit,
    _offset: offset,
  });

  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) return EMPTY_CATALOG;

  const payload = data as Partial<PublicResourceCatalog>;
  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    total: typeof payload.total === "number" ? payload.total : 0,
    has_more: payload.has_more === true,
    facets: {
      levels: Array.isArray(payload.facets?.levels) ? payload.facets.levels : [],
      themes: Array.isArray(payload.facets?.themes) ? payload.facets.themes : [],
      resource_types: Array.isArray(payload.facets?.resource_types)
        ? payload.facets.resource_types
        : [],
    },
  };
}

export function usePublicResourceCatalog(params: PublicResourceCatalogParams) {
  return useQuery({
    queryKey: publicResourceCatalogKey(params),
    queryFn: () => fetchPublicResourceCatalog(params),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: Boolean(params.locale),
  });
}
