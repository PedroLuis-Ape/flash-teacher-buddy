import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { toast } from "sonner";

export type AttentionResourceType = "folder" | "list";

const storageKey = (userId: string, resourceType: AttentionResourceType) =>
  `piteco:attention:${userId}:${resourceType}`;

function readLocalAttention(userId: string, resourceType: AttentionResourceType): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userId, resourceType)) ?? "[]");
    return Array.isArray(parsed)
      ? Array.from(new Set(parsed.filter((value): value is string => typeof value === "string" && value.length > 0)))
      : [];
  } catch {
    return [];
  }
}

function writeLocalAttention(userId: string, resourceType: AttentionResourceType, ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId, resourceType), JSON.stringify(Array.from(new Set(ids))));
}

function isMissingAttentionTable(error: unknown) {
  const value = error as { code?: string; message?: string; details?: string } | null;
  const text = `${value?.code ?? ""} ${value?.message ?? ""} ${value?.details ?? ""}`.toLowerCase();
  return text.includes("42p01")
    || text.includes("pgrst205")
    || text.includes("schema cache")
    || text.includes("does not exist")
    || text.includes("user_resource_attention");
}

async function fetchCloudAttention(userId: string, resourceType: AttentionResourceType): Promise<string[] | null> {
  try {
    const rows = await fetchAllSupabaseRows<{ resource_id: string }>((from, to) =>
      (supabase as any)
        .from("user_resource_attention")
        .select("resource_id")
        .eq("user_id", userId)
        .eq("resource_type", resourceType)
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    return rows.map((row) => row.resource_id);
  } catch (error) {
    if (!isMissingAttentionTable(error)) {
      console.warn("[attention] cloud read failed; using device fallback", error);
    }
  }

  if (resourceType !== "list") return null;

  try {
    const rows = await fetchAllSupabaseRows<{ list_id: string }>((from, to) =>
      (supabase as any)
        .from("user_list_attention")
        .select("list_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    return rows.map((row) => row.list_id);
  } catch (error) {
    if (!isMissingAttentionTable(error)) {
      console.warn("[attention] legacy list read failed; using device fallback", error);
    }
    return null;
  }
}

async function writeCloudAttention({
  userId,
  resourceType,
  resourceId,
  enabled,
}: {
  userId: string;
  resourceType: AttentionResourceType;
  resourceId: string;
  enabled: boolean;
}): Promise<boolean> {
  try {
    const query = (supabase as any).from("user_resource_attention");
    const { error } = enabled
      ? await query.insert({ user_id: userId, resource_type: resourceType, resource_id: resourceId })
      : await query.delete().eq("user_id", userId).eq("resource_type", resourceType).eq("resource_id", resourceId);

    if (!error || error.code === "23505") return true;
    if (!isMissingAttentionTable(error)) {
      console.warn("[attention] cloud write failed; keeping device fallback", error);
      return false;
    }
  } catch (error) {
    if (!isMissingAttentionTable(error)) {
      console.warn("[attention] cloud write threw; keeping device fallback", error);
      return false;
    }
  }

  if (resourceType !== "list") return false;

  try {
    const query = (supabase as any).from("user_list_attention");
    const { error } = enabled
      ? await query.insert({ user_id: userId, list_id: resourceId })
      : await query.delete().eq("user_id", userId).eq("list_id", resourceId);
    return !error || error.code === "23505";
  } catch (error) {
    console.warn("[attention] legacy list write failed; keeping device fallback", error);
    return false;
  }
}

export function useResourceAttention(userId: string | undefined, resourceType: AttentionResourceType) {
  return useQuery({
    queryKey: ["resource-attention", userId, resourceType],
    queryFn: async () => {
      if (!userId) return [];
      const local = readLocalAttention(userId, resourceType);
      const cloud = await fetchCloudAttention(userId, resourceType);
      const merged = Array.from(new Set([...(cloud ?? []), ...local]));
      writeLocalAttention(userId, resourceType, merged);
      return merged;
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useToggleResourceAttention() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["resource-attention-toggle"],
    mutationFn: async ({
      userId,
      resourceType,
      resourceId,
      isAttention,
    }: {
      userId: string;
      resourceType: AttentionResourceType;
      resourceId: string;
      isAttention: boolean;
    }) => {
      const enabled = !isAttention;
      const current = readLocalAttention(userId, resourceType);
      const next = enabled
        ? Array.from(new Set([...current, resourceId]))
        : current.filter((id) => id !== resourceId);
      writeLocalAttention(userId, resourceType, next);

      const cloudPersisted = await writeCloudAttention({ userId, resourceType, resourceId, enabled });
      return { userId, resourceType, resourceId, enabled, cloudPersisted };
    },
    onMutate: async ({ userId, resourceType, resourceId, isAttention }) => {
      const queryKey = ["resource-attention", userId, resourceType] as const;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<string[]>(queryKey) ?? [];
      queryClient.setQueryData<string[]>(queryKey, (current = []) =>
        isAttention
          ? current.filter((id) => id !== resourceId)
          : current.includes(resourceId) ? current : [...current, resourceId],
      );
      return { previous, queryKey };
    },
    onError: (error, _variables, context) => {
      if (context?.queryKey) queryClient.setQueryData(context.queryKey, context.previous);
      console.error("Error toggling attention marker:", error);
      toast.error("Erro ao alterar a marca de atenção");
    },
    onSuccess: ({ enabled, cloudPersisted }) => {
      toast.success(
        enabled
          ? cloudPersisted ? "🔴 Marcado para prestar atenção" : "🔴 Marcado neste dispositivo"
          : "Marca de atenção removida",
      );
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.queryKey) queryClient.invalidateQueries({ queryKey: context.queryKey });
    },
  });
}
