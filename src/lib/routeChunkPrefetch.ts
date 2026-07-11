export function createOneShotPrefetch(loader: () => Promise<unknown>): () => void {
  let pending: Promise<unknown> | null = null;
  return () => {
    if (pending) return;
    pending = loader().catch((error) => {
      pending = null;
      if (import.meta.env.DEV) console.debug("[route-prefetch] chunk preload failed", error);
    });
  };
}

export const prefetchFolderRouteChunks = createOneShotPrefetch(async () => {
  await Promise.all([
    import("@/pages/FolderWithExport"),
    import("@/pages/Folder"),
  ]);
});

export const prefetchListRouteChunks = createOneShotPrefetch(async () => {
  await import("@/pages/ListDetail");
});

export const prefetchStudyRouteChunks = createOneShotPrefetch(async () => {
  await Promise.all([
    import("@/pages/GamesHub"),
    import("@/pages/Study"),
  ]);
});
