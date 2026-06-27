import { useQuery } from "@tanstack/react-query";

export function useListAttention(userId: string | undefined) {
  return useQuery({
    queryKey: ["list-attention", userId],
    queryFn: async () => [] as string[],
    enabled: Boolean(userId),
  });
}
