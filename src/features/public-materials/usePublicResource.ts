import { useQuery } from "@tanstack/react-query";
import { publicSupabase } from "@/integrations/supabase/publicClient";

export interface PublicResourceSample { term: string; translation: string }

export interface PublicResource {
  source: "editorial" | "none";
  locale: string;
  slug?: string;
  canonical_path?: string;
  play_path?: string;
  reason?: string;
  editorial?: {
    level: string | null;
    theme: string | null;
    resource_type: string | null;
    summary: string | null;
    reviewed_at: string | null;
  };
  list?: {
    id: string;
    title: string;
    folder_title: string | null;
    study_type: string | null;
    lang_a: string | null;
    lang_b: string | null;
    card_count: number;
    author_name: string;
    author_slug: string | null;
  };
  samples?: PublicResourceSample[];
}

export const publicResourceKey = (locale: string, slug: string) =>
  ["public", "resource", locale, slug] as const;

export async function fetchPublicResource(locale: string, slug: string): Promise<PublicResource> {
  const { data, error } = await (publicSupabase.rpc as any)("get_public_resource_v1", {
    _locale: locale,
    _slug: slug,
  });
  if (error) throw error;
  const payload = (data ?? null) as PublicResource | null;
  if (!payload || typeof payload !== "object") return { source: "none", locale };
  return payload;
}

export function usePublicResource(locale: string, slug: string) {
  return useQuery({
    queryKey: publicResourceKey(locale, slug),
    queryFn: () => fetchPublicResource(locale, slug),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: Boolean(locale && slug),
  });
}

