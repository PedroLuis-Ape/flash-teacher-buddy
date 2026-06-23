import { useQuery } from "@tanstack/react-query";
import { loadFolderScopedGlossary } from "@/features/study/lib/folderGlossaryApi";

export function useFolderGlossary(folderId?: string) {
  return useQuery({
    queryKey: ["account-glossary", "folder", folderId],
    queryFn: () => loadFolderScopedGlossary(folderId!),
    enabled: Boolean(folderId),
    staleTime: 60_000,
  });
}
