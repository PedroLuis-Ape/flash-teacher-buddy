import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SEOHead } from "@/components/seo/SEOHead";
import { buildPublicLearningResourceStructuredData } from "@/components/seo/publicLearningResourceStructuredData";
import { supabase } from "@/integrations/supabase/client";
import Folder from "./Folder";

interface PublicFolderMetadata {
  id: string;
  title: string;
  description: string | null;
  study_type?: string | null;
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  author_display_name?: string | null;
  author_slug?: string | null;
  author_avatar_url?: string | null;
}

interface PublicFolderListMetadata {
  id: string;
  title: string;
  description: string | null;
  card_count?: number | string | null;
}

function isMissingRpc(error: unknown, functionName: string) {
  const candidate = error as { code?: string; message?: string; details?: string } | null;
  const text = `${candidate?.code ?? ""} ${candidate?.message ?? ""} ${candidate?.details ?? ""}`.toLowerCase();
  return text.includes("pgrst202") || text.includes("42883") || text.includes(functionName.toLowerCase());
}

async function loadPublicFolderMetadata(id: string): Promise<PublicFolderMetadata | null> {
  const canonical = await (supabase.rpc as any)("get_public_learning_resource", { _id: id });
  if (!canonical.error) {
    const row = Array.isArray(canonical.data) ? canonical.data[0] : canonical.data;
    return (row ?? null) as PublicFolderMetadata | null;
  }

  if (!isMissingRpc(canonical.error, "get_public_learning_resource")) throw canonical.error;

  const legacy = await (supabase.rpc as any)("get_portal_folder", { _id: id });
  if (legacy.error) throw legacy.error;
  const row = Array.isArray(legacy.data) ? legacy.data[0] : legacy.data;
  return (row ?? null) as PublicFolderMetadata | null;
}

async function loadPublicFolderLists(id: string): Promise<PublicFolderListMetadata[]> {
  const response = await (supabase.rpc as any)("get_public_learning_resource_lists", { _folder_id: id });
  if (!response.error) return (response.data ?? []) as PublicFolderListMetadata[];
  if (isMissingRpc(response.error, "get_public_learning_resource_lists")) return [];
  throw response.error;
}

export default function PublicFolderRoute() {
  const { id = "" } = useParams<{ id: string }>();

  const resourceQuery = useQuery({
    queryKey: ["public-learning-resource-seo", id],
    queryFn: () => loadPublicFolderMetadata(id),
    enabled: Boolean(id),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const listsQuery = useQuery({
    queryKey: ["public-learning-resource-lists-seo", id],
    queryFn: () => loadPublicFolderLists(id),
    enabled: Boolean(id && resourceQuery.data),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const resource = resourceQuery.data ?? null;
  const lists = listsQuery.data ?? [];
  const path = `/portal/folder/${id}`;

  return (
    <>
      {resource ? (
        <SEOHead
          title={`${resource.title} | Material público no APE`}
          description={resource.description || `${resource.title}: material público de estudo no APE.`}
          path={path}
          image={resource.author_avatar_url || undefined}
          imageAlt={`Identidade visual do material ${resource.title}`}
          jsonLd={buildPublicLearningResourceStructuredData(resource, lists)}
        />
      ) : !resourceQuery.isLoading ? (
        <SEOHead
          title="Material público não encontrado | APE"
          description="Este material não existe, deixou de ser público ou ainda não foi publicado."
          path={path}
          canonicalPath={null}
          robots="noindex,nofollow"
        />
      ) : null}
      <Folder />
    </>
  );
}
