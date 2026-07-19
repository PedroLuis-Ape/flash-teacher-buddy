import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PRODUCTION_DATA_PROJECT_ID } from "@/integrations/supabase/platformRuntime";
import { fetchImportCapabilities } from "./capabilities";

export function useImportCapabilities(active: boolean) {
  const { status, userId } = useAuth();
  return useQuery({
    queryKey: ["import-capabilities-v1", userId, PRODUCTION_DATA_PROJECT_ID],
    queryFn: fetchImportCapabilities,
    enabled: active && status === "authenticated" && Boolean(userId),
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
