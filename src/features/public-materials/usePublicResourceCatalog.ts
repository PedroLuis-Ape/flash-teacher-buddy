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

const INVALID_CATALOG_RESPONSE = "Resposta inválida de list_public_resources_v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isCatalogItem(value: unknown): value is PublicResourceCatalogItem {
  if (!isRecord(value)) return false;

  return (
    typeof value.slug === "string" &&
    typeof value.title === "string" &&
    isNullableString(value.folder_title) &&
    isNullableString(value.level) &&
    isNullableString(value.theme) &&
    isNullableString(value.resource_type) &&
    isNullableString(value.summary) &&
    isNonNegativeInteger(value.card_count) &&
    typeof value.author_name === "string" &&
    isNullableString(value.author_slug) &&
    isNullableString(value.canonical_path) &&
    typeof value.play_path === "string"
  );
}

function isCatalogFacet(value: unknown): value is PublicResourceCatalogFacet {
  return (
    isRecord(value) &&
    typeof value.value === "string" &&
    isNonNegativeInteger(value.count)
  );
}

export function parsePublicResourceCatalog(data: unknown): PublicResourceCatalog {
  if (
    !isRecord(data) ||
    !Array.isArray(data.items) ||
    !data.items.every(isCatalogItem) ||
    !isNonNegativeInteger(data.total) ||
    typeof data.has_more !== "boolean" ||
    !isRecord(data.facets) ||
    !Array.isArray(data.facets.levels) ||
    !data.facets.levels.every(isCatalogFacet) ||
    !Array.isArray(data.facets.themes) ||
    !data.facets.themes.every(isCatalogFacet) ||
    !Array.isArray(data.facets.resource_types) ||
    !data.facets.resource_types.every(isCatalogFacet)
  ) {
    throw new Error(INVALID_CATALOG_RESPONSE);
  }

  return {
    items: data.items,
    total: data.total,
    has_more: data.has_more,
    facets: {
      levels: data.facets.levels,
      themes: data.facets.themes,
      resource_types: data.facets.resource_types,
    },
  };
}

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
  return parsePublicResourceCatalog(data);
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
