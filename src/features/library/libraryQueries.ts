import { supabase } from "@/integrations/supabase/client";

export interface LibraryFolder {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  owner_id: string;
  list_count: number;
  card_count: number;
  isOwner: true;
}

export interface LibraryList {
  id: string;
  title: string;
  description: string | null;
  folder_id: string;
  folder_title: string | null;
  card_count: number;
}

export interface LibraryTeacher {
  id: string;
  first_name: string;
  avatar_url?: string | null;
  folder_count?: number;
  list_count?: number;
  card_count?: number;
}

export interface LibrarySnapshot {
  folders: LibraryFolder[];
  lists: LibraryList[];
}

export const libraryKeys = {
  all: ["library"] as const,
  snapshot: (userId: string, institutionId: string | null) =>
    ["library", "snapshot", userId, institutionId ?? "general"] as const,
  teachers: (userId: string) => ["library", "teachers", userId] as const,
};

export function normalizeLibrarySnapshot(input: {
  folders: any[];
  lists: any[];
  cardCounts: Array<{ list_id: string; card_count: number | string }>;
}): LibrarySnapshot {
  const counts = new Map<string, number>();
  for (const row of input.cardCounts) {
    if (!row || typeof row.list_id !== "string") continue;
    const value = Number(row.card_count);
    counts.set(row.list_id, Number.isFinite(value) ? value : 0);
  }

  const folders: LibraryFolder[] = input.folders.map((folder) => {
    const activeLists = (folder.lists ?? []).filter(
      (list: any) => list?.deleted_at == null && typeof list?.id === "string",
    );
    return {
      id: folder.id,
      title: folder.title,
      description: folder.description ?? null,
      visibility: folder.visibility,
      owner_id: folder.owner_id,
      list_count: activeLists.length,
      card_count: activeLists.reduce(
        (sum: number, list: any) => sum + (counts.get(list.id) ?? 0),
        0,
      ),
      isOwner: true,
    };
  });

  const lists: LibraryList[] = input.lists.map((list) => ({
    id: list.id,
    title: list.title,
    description: list.description ?? null,
    folder_id: list.folder_id,
    folder_title: list.folders?.title ?? null,
    card_count: counts.get(list.id) ?? 0,
  }));

  return { folders, lists };
}

export function removeFoldersFromSnapshot(
  snapshot: LibrarySnapshot | undefined,
  ids: ReadonlySet<string>,
): LibrarySnapshot | undefined {
  if (!snapshot) return snapshot;
  return {
    folders: snapshot.folders.filter((folder) => !ids.has(folder.id)),
    lists: snapshot.lists.filter((list) => !ids.has(list.folder_id)),
  };
}

export function insertFolderIntoSnapshot(
  snapshot: LibrarySnapshot | undefined,
  folder: LibraryFolder,
): LibrarySnapshot {
  return {
    folders: [folder, ...(snapshot?.folders ?? []).filter((item) => item.id !== folder.id)],
    lists: snapshot?.lists ?? [],
  };
}

export async function fetchLibrarySnapshot(
  userId: string,
  institutionId: string | null,
): Promise<LibrarySnapshot> {
  const client = supabase as any;
  let foldersQuery = client
    .from("folders")
    .select("id,title,description,visibility,owner_id,institution_id,lists(id,deleted_at)")
    .eq("owner_id", userId)
    .is("class_id", null)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  let listsQuery = client
    .from("lists")
    .select("id,title,description,folder_id,folders!inner(title,owner_id,institution_id,class_id)")
    .eq("folders.owner_id", userId)
    .is("folders.class_id", null)
    .is("deleted_at", null);

  if (institutionId) {
    foldersQuery = foldersQuery.eq("institution_id", institutionId);
    listsQuery = listsQuery.eq("folders.institution_id", institutionId);
  } else {
    foldersQuery = foldersQuery.is("institution_id", null);
    listsQuery = listsQuery.is("folders.institution_id", null);
  }

  const [foldersResult, listsResult, countsResult] = await Promise.all([
    foldersQuery,
    listsQuery,
    client.rpc("get_user_card_counts", {
      _user_id: userId,
      _institution_id: institutionId,
    }),
  ]);

  if (foldersResult.error) throw foldersResult.error;
  if (listsResult.error) throw listsResult.error;

  return normalizeLibrarySnapshot({
    folders: foldersResult.data ?? [],
    lists: listsResult.data ?? [],
    cardCounts: Array.isArray(countsResult.data) ? countsResult.data : [],
  });
}

export async function fetchSubscribedTeachers(userId: string): Promise<LibraryTeacher[]> {
  const client = supabase as any;
  const { data: subscriptions, error } = await client
    .from("subscriptions")
    .select("teacher_id")
    .eq("student_id", userId);
  if (error) throw error;

  const ids = Array.from(
    new Set<string>((subscriptions ?? []).map((row: any) => row.teacher_id).filter(Boolean)),
  );
  if (!ids.length) return [];

  const { data: profiles, error: profilesError } = await client
    .from("profiles")
    .select("id,first_name,avatar_url")
    .in("id", ids);
  if (profilesError) throw profilesError;
  return profiles ?? [];
}
