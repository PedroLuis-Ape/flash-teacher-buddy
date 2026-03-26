import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized auth hook — single getSession() cached via React Query.
 * All components should use this instead of calling supabase.auth.getSession() directly.
 */
export function useAuthUser() {
  const { data, isLoading } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) return { user: null, session: null };
      return { user: session.user, session };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    user: data?.user ?? null,
    session: data?.session ?? null,
    isLoading,
    userId: data?.user?.id,
    accessToken: data?.session?.access_token,
  };
}
