import type { QueryClient } from "@tanstack/react-query";
import { loadOwnAccountGlossary } from "@/features/study/lib/accountGlossaryApi";
import { configuredSupabaseProjectRef, glossaryServiceMessage } from "./glossaryServiceError";

const ACCOUNT_GLOSSARY_QUERY_KEY = ["account-glossary"] as const;

export interface AccountGlossarySyncReport {
  totalEntries: number;
  activeEntries: number;
  listCount: number;
  projectRef: string;
  syncedAt: string;
}

export async function forceAccountGlossarySync(
  queryClient: QueryClient,
  listCount: number,
): Promise<AccountGlossarySyncReport> {
  await queryClient.cancelQueries({ queryKey: ACCOUNT_GLOSSARY_QUERY_KEY });
  queryClient.removeQueries({ queryKey: ACCOUNT_GLOSSARY_QUERY_KEY });

  try {
    const glossary = await loadOwnAccountGlossary();
    queryClient.setQueryData([...ACCOUNT_GLOSSARY_QUERY_KEY, "self"], glossary);
    await queryClient.refetchQueries({ queryKey: ACCOUNT_GLOSSARY_QUERY_KEY, type: "active" });

    return {
      totalEntries: glossary.length,
      activeEntries: glossary.filter((entry) => entry.is_active).length,
      listCount: Math.max(0, listCount),
      projectRef: configuredSupabaseProjectRef(),
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(glossaryServiceMessage(error, "sincronizar"));
  }
}
