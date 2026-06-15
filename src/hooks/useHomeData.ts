import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/contexts/InstitutionContext";
import { useQuery } from "@tanstack/react-query";
import { useAuthUser } from "@/hooks/useAuthUser";

interface LastSession {
  id: string;
  title: string;
  total: number;
  reviewed: number;
  mode: string;
}

interface RecentList {
  id: string;
  title: string;
  count: number;
  folder_name?: string;
  is_own: boolean;
  last_activity?: string | null;
}

export interface RecentFolder {
  id: string;
  title: string;
  list_count: number;
  card_count: number;
  last_activity: string | null;
  institution_id: string | null;
}

interface TeacherInfo {
  id: string;
  name: string;
  folder_count: number;
}

interface Stats {
  total_lists: number;
  total_cards: number;
  teachers_count: number;
}

interface HomeData {
  last: LastSession | null;
  recents: RecentList[];
  recentFolders: RecentFolder[];
  teachers: TeacherInfo[];
  stats: Stats;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

type HomeDataPayload = Omit<HomeData, 'refetch' | 'loading' | 'error'>;

const EMPTY_PAYLOAD: HomeDataPayload = {
  last: null,
  recents: [],
  recentFolders: [],
  teachers: [],
  stats: { total_lists: 0, total_cards: 0, teachers_count: 0 },
};

const toArray = <T,>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];
const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toText = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;

function applyInstitutionFilter<T extends { eq: Function; is: Function }>(query: T, institutionId: string | null): T {
  return (institutionId
    ? query.eq("institution_id", institutionId)
    : query.is("institution_id", null)) as T;
}

async function fetchHomeData(userId: string, institutionId: string | null): Promise<HomeDataPayload> {
  if (import.meta.env.DEV) console.time('[HomeData] load');

  try {
    let ownListsQuery = supabase
      .from("lists")
      .select("id, title, updated_at, folder_id, folders(title)")
      .eq("owner_id", userId)
      .is("class_id", null)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(20);
    ownListsQuery = applyInstitutionFilter(ownListsQuery, institutionId);

    let listCountQuery = supabase
      .from("lists")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .is("class_id", null)
      .is("deleted_at", null);
    listCountQuery = applyInstitutionFilter(listCountQuery, institutionId);

    let recentFoldersQuery = supabase
      .from("folders")
      .select("id, title, updated_at, institution_id")
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(5);
    recentFoldersQuery = applyInstitutionFilter(recentFoldersQuery, institutionId);

    const [
      sessionResult,
      ownListsResult,
      subscribedTeachersResult,
      activityResult,
      turmaTeachersResult,
      listCountResult,
      cardCountsResult,
      recentFoldersResult,
    ] = await Promise.all([
      supabase
        .from("study_sessions")
        .select("list_id, mode, current_index, cards_order, lists(id, title, institution_id)")
        .eq("user_id", userId)
        .eq("completed", false)
        .order("updated_at", { ascending: false })
        .limit(10),
      ownListsQuery,
      (supabase.rpc as any)('get_subscribed_teachers_with_stats', { _student_id: userId }),
      supabase
        .from("user_list_activity")
        .select("list_id, last_studied_at, last_opened_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase
        .from("turma_membros")
        .select("turma_id, turmas(owner_teacher_id, nome, institution_id)")
        .eq("user_id", userId)
        .eq("ativo", true),
      listCountQuery,
      supabase.rpc('get_user_card_counts', {
        _user_id: userId,
        _institution_id: institutionId,
      }),
      recentFoldersQuery,
    ]);

    const criticalErrors = [
      sessionResult.error,
      ownListsResult.error,
      activityResult.error,
      turmaTeachersResult.error,
      listCountResult.error,
      cardCountsResult.error,
      recentFoldersResult.error,
    ].filter(Boolean);
    if (criticalErrors.length > 0) throw criticalErrors[0];

    const subscribedRows = toArray<any>(subscribedTeachersResult.data as any[]);
    const subscriptionTeacherIds = subscribedRows
      .map((row) => row?.teacher_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const turmaTeacherIds = toArray<any>(turmaTeachersResult.data as any[])
      .filter((member) => {
        const turma = Array.isArray(member?.turmas) ? member.turmas[0] : member?.turmas;
        return institutionId ? turma?.institution_id === institutionId : true;
      })
      .map((member) => {
        const turma = Array.isArray(member?.turmas) ? member.turmas[0] : member?.turmas;
        return turma?.owner_teacher_id;
      })
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const allTeacherIds = [...new Set([...subscriptionTeacherIds, ...turmaTeacherIds])];
    const subscribedIdSet = new Set(subscriptionTeacherIds);
    const missingTurmaTeacherIds = turmaTeacherIds.filter((id) => !subscribedIdSet.has(id));
    const recentFolderIds = toArray<any>(recentFoldersResult.data as any[])
      .map((folder) => folder?.id)
      .filter((id): id is string => typeof id === "string");

    let sharedQuery: any = null;
    if (allTeacherIds.length > 0) {
      sharedQuery = supabase
        .from("lists")
        .select("id, title, updated_at, folders(title, owner_id), flashcards(count)")
        .in("owner_id", allTeacherIds)
        .eq("visibility", "class")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(10);
      sharedQuery = applyInstitutionFilter(sharedQuery, institutionId);
    }

    const [sharedResult, folderListsResult, missingProfilesResult, missingFoldersResult] = await Promise.all([
      sharedQuery ?? Promise.resolve({ data: [], error: null }),
      recentFolderIds.length > 0
        ? supabase
            .from("lists")
            .select("id, folder_id")
            .in("folder_id", recentFolderIds)
            .eq("owner_id", userId)
            .is("class_id", null)
            .is("deleted_at", null)
        : Promise.resolve({ data: [], error: null }),
      missingTurmaTeacherIds.length > 0
        ? supabase.from("profiles").select("id, first_name").in("id", missingTurmaTeacherIds)
        : Promise.resolve({ data: [], error: null }),
      missingTurmaTeacherIds.length > 0
        ? supabase
            .from("folders")
            .select("owner_id")
            .in("owner_id", missingTurmaTeacherIds)
            .eq("visibility", "class")
            .is("deleted_at", null)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const secondaryErrors = [
      sharedResult.error,
      folderListsResult.error,
      missingProfilesResult.error,
      missingFoldersResult.error,
    ].filter(Boolean);
    if (secondaryErrors.length > 0) throw secondaryErrors[0];

    const perListCardCounts: Record<string, number> = {};
    for (const row of toArray<any>(cardCountsResult.data as any[])) {
      if (typeof row?.list_id === "string") perListCardCounts[row.list_id] = toNumber(row.card_count);
    }

    const activityMap = new Map<string, string | null>();
    for (const activity of toArray<any>(activityResult.data as any[])) {
      if (typeof activity?.list_id !== "string") continue;
      activityMap.set(activity.list_id, activity.last_studied_at || activity.last_opened_at || null);
    }

    const ownListsMapped: RecentList[] = toArray<any>(ownListsResult.data as any[]).map((list) => {
      const folder = Array.isArray(list?.folders) ? list.folders[0] : list?.folders;
      return {
        id: list.id,
        title: toText(list.title, "Sem título"),
        count: toNumber(perListCardCounts[list.id]),
        folder_name: toText(folder?.title, "Minhas Listas"),
        is_own: true,
        last_activity: activityMap.get(list.id) || list.updated_at || null,
      };
    });

    const sharedListsMapped: RecentList[] = toArray<any>(sharedResult.data as any[]).map((list) => {
      const folder = Array.isArray(list?.folders) ? list.folders[0] : list?.folders;
      const count = Array.isArray(list?.flashcards) ? list.flashcards[0]?.count : list?.flashcards?.count;
      return {
        id: list.id,
        title: toText(list.title, "Sem título"),
        count: toNumber(count),
        folder_name: toText(folder?.title, "Compartilhado"),
        is_own: false,
        last_activity: activityMap.get(list.id) || list.updated_at || null,
      };
    });

    const recents = [...ownListsMapped, ...sharedListsMapped]
      .sort((a, b) => new Date(b.last_activity || 0).getTime() - new Date(a.last_activity || 0).getTime())
      .slice(0, 5);

    const folderListMap = new Map<string, string[]>();
    for (const list of toArray<any>(folderListsResult.data as any[])) {
      if (typeof list?.folder_id !== "string" || typeof list?.id !== "string") continue;
      const ids = folderListMap.get(list.folder_id) || [];
      ids.push(list.id);
      folderListMap.set(list.folder_id, ids);
    }

    const recentFolders: RecentFolder[] = toArray<any>(recentFoldersResult.data as any[]).map((folder) => {
      const listIds = folderListMap.get(folder.id) || [];
      return {
        id: folder.id,
        title: toText(folder.title, "Sem título"),
        list_count: listIds.length,
        card_count: listIds.reduce((sum, listId) => sum + toNumber(perListCardCounts[listId]), 0),
        last_activity: folder.updated_at || null,
        institution_id: folder.institution_id || null,
      };
    });

    const teachers: TeacherInfo[] = subscribedRows
      .filter((row) => typeof row?.teacher_id === "string")
      .map((row) => ({
        id: row.teacher_id,
        name: toText(row.first_name, "Professor"),
        folder_count: toNumber(row.folder_count),
      }));

    const folderCountMap = new Map<string, number>();
    for (const folder of toArray<any>(missingFoldersResult.data as any[])) {
      if (typeof folder?.owner_id !== "string") continue;
      folderCountMap.set(folder.owner_id, (folderCountMap.get(folder.owner_id) || 0) + 1);
    }
    for (const profile of toArray<any>(missingProfilesResult.data as any[])) {
      if (typeof profile?.id !== "string") continue;
      teachers.push({
        id: profile.id,
        name: toText(profile.first_name, "Professor"),
        folder_count: folderCountMap.get(profile.id) || 0,
      });
    }

    let last: LastSession | null = null;
    const rawSession = toArray<any>(sessionResult.data as any[]).find((session) => {
      const list = Array.isArray(session?.lists) ? session.lists[0] : session?.lists;
      const listInstitution = list?.institution_id || null;
      return institutionId ? listInstitution === institutionId : listInstitution === null;
    });
    if (rawSession?.list_id) {
      const list = Array.isArray(rawSession.lists) ? rawSession.lists[0] : rawSession.lists;
      const cardsOrder = toArray<any>(rawSession.cards_order as any[]);
      last = {
        id: rawSession.list_id,
        title: toText(list?.title, "Sem título"),
        total: cardsOrder.length,
        reviewed: Math.max(0, Math.min(toNumber(rawSession.current_index), cardsOrder.length)),
        mode: toText(rawSession.mode, "flip"),
      };
    }

    const totalCards = Object.values(perListCardCounts).reduce((sum, count) => sum + count, 0);

    return {
      last,
      recents,
      recentFolders,
      teachers: teachers.slice(0, 3),
      stats: {
        total_lists: listCountResult.count || 0,
        total_cards: totalCards,
        teachers_count: allTeacherIds.length,
      },
    };
  } finally {
    if (import.meta.env.DEV) console.timeEnd('[HomeData] load');
  }
}

export function useHomeData(): HomeData {
  const { selectedInstitution } = useInstitution();
  const { userId } = useAuthUser();
  const institutionId = selectedInstitution?.id ?? null;

  const query = useQuery<HomeDataPayload>({
    queryKey: ['home-data', userId, selectedInstitution?.id ?? 'general'],
    queryFn: () => fetchHomeData(userId as string, institutionId),
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const payload = query.data ?? EMPTY_PAYLOAD;
  return {
    ...payload,
    loading: !!userId && query.isLoading,
    error: query.isError ? "Erro ao carregar dados" : null,
    refetch: () => { void query.refetch(); },
  };
}
