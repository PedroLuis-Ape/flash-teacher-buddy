import { useQuery } from "@tanstack/react-query";
import { getCurrentAppLocale } from "@/i18n";
import { publicSupabase } from "@/integrations/supabase/publicClient";

export interface FeaturedResourceSample {
  term: string;
  translation: string;
}

export interface FeaturedResourceList {
  id: string;
  title: string;
  folder_title: string | null;
  study_type: string | null;
  lang_a: string | null;
  lang_b: string | null;
  card_count: number;
  author_name: string;
  author_slug: string | null;
}

export interface FeaturedPublicResource {
  source: "config" | "fallback" | "none";
  locale: string;
  play_path?: string;
  list?: FeaturedResourceList;
  samples?: FeaturedResourceSample[];
}

/**
 * Destaque da Home publica.
 *
 * A fonte e o banco (app_config.featured_public_resource) e a RPC devolve
 * `source: 'none'` quando nao existe material publico elegivel. Nesse caso a
 * secao inteira nao e renderizada — a Home nunca inventa atividade.
 */
export const featuredPublicResourceKey = (locale: string) =>
  ["public", "featured-public-resource", locale] as const;

export async function fetchFeaturedPublicResource(
  locale: string,
): Promise<FeaturedPublicResource> {
  const { data, error } = await (publicSupabase.rpc as any)("get_featured_public_resource_v1", {
    _locale: locale,
  });
  if (error) throw error;
  const payload = (data ?? null) as FeaturedPublicResource | null;
  if (!payload || typeof payload !== "object") return { source: "none", locale };
  return payload;
}

export function useFeaturedPublicResource() {
  const locale = getCurrentAppLocale();
  return useQuery({
    queryKey: featuredPublicResourceKey(locale),
    queryFn: () => fetchFeaturedPublicResource(locale),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

