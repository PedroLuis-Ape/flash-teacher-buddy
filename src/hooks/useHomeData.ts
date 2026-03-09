import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/contexts/InstitutionContext";
import { useQueryClient } from "@tanstack/react-query";

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
  teachers: TeacherInfo[];
  stats: Stats;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useHomeData(): HomeData {
  const { selectedInstitution } = useInstitution();
  const queryClient = useQueryClient();
  const [data, setData] = useState<Omit<HomeData, 'refetch'>>({
    last: null,
    recents: [],
    teachers: [],
    stats: { total_lists: 0, total_cards: 0, teachers_count: 0 },
    loading: true,
    error: null,
  });

  const toArray = <T,>(value: T[] | null | undefined): T[] =>
    Array.isArray(value) ? value : [];

  const toNumber = (value: unknown, fallback = 0): number => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const toText = (value: unknown, fallback: string): string => {
    return typeof value === "string" && value.trim().length > 0 ? value : fallback;
  };

  const loadData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, loading: true }));
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setData({ 
          last: null, 
          recents: [], 
          teachers: [],
          stats: { total_lists: 0, total_cards: 0, teachers_count: 0 },
          loading: false, 
          error: null 
        });
        return;
      }

      const userId = session.user.id;
      const institutionId = selectedInstitution?.id || null;

      // Fetch in parallel
      const [sessionResult, ownListsResult, subscriptionsResult, activityResult, turmaTeachersResult, statsCountResult] = await Promise.all([
        // Last study session — filtered by institution via lists→folders
        (async () => {
          const { data } = await supabase
            .from("study_sessions")
            .select(`
              list_id,
              mode,
              current_index,
              cards_order,
              lists (
                id,
                title,
                institution_id
              )
            `)
            .eq("user_id", userId)
            .eq("completed", false)
            .order("updated_at", { ascending: false })
            .limit(10);
          
          // Filter by institution client-side (session join doesn't support nested eq)
          const filtered = (data || []).filter((s: any) => {
            const listRel = Array.isArray(s.lists) ? s.lists[0] : s.lists;
            const listInst = listRel?.institution_id || null;
            return institutionId ? listInst === institutionId : listInst === null;
          });
          return { data: filtered[0] || null, error: null };
        })(),

        // Own lists (exclude assignment copies - class_id IS NULL)
        (() => {
          let query = supabase
            .from("lists")
            .select(`
              id,
              title,
              updated_at,
              flashcards(id),
              folders(title)
            `)
            .eq("owner_id", userId)
            .is("class_id", null)
            .is("deleted_at", null)
            .order("updated_at", { ascending: false })
            .limit(20);
          
          if (institutionId) {
            query = query.eq("institution_id", institutionId);
          }
          
          return query;
        })(),

        // Subscriptions (teachers) - legacy method
        supabase
          .from("subscriptions")
          .select("teacher_id")
          .eq("student_id", userId),

        // User list activity - for ordering by last_studied_at
        supabase
          .from("user_list_activity")
          .select("list_id, last_studied_at, last_opened_at")
          .eq("user_id", userId),
          
        // Get teachers from turma_membros (primary method for students)
        supabase
          .from("turma_membros")
          .select("turma_id, turmas(owner_teacher_id, nome, institution_id)")
          .eq("user_id", userId)
          .eq("ativo", true),

        // Accurate stats count for current institution
        (async () => {
          let countQuery = supabase
            .from("lists")
            .select("id, flashcards(id)", { count: "exact" })
            .eq("owner_id", userId)
            .is("class_id", null)
            .is("deleted_at", null);

          if (institutionId) {
            countQuery = countQuery.eq("institution_id", institutionId);
          } else {
            countQuery = countQuery.is("institution_id", null);
          }

          const { data, count } = await countQuery;
          const totalCards = (data || []).reduce((sum: number, l: any) =>
            sum + (Array.isArray(l?.flashcards) ? l.flashcards.length : 0), 0);
          return { listCount: count || 0, cardCount: totalCards };
        })()
      ]);

      const subscriptionTeacherIds = toArray<any>(subscriptionsResult.data as any[])
        .map((s) => s?.teacher_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      
      const turmaTeacherIds = toArray<any>(turmaTeachersResult.data as any[])
        .filter((m) => {
          // Filter turmas by institution
          const turmaInst = m?.turmas?.institution_id || null;
          return institutionId ? turmaInst === institutionId : true;
        })
        .map((m) => m?.turmas?.owner_teacher_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      
      // Combine and dedupe teacher IDs
      const allTeacherIds = [...new Set([...subscriptionTeacherIds, ...turmaTeacherIds])];

      // Fetch shared lists from teachers if any
      let sharedLists: any[] = [];
      if (allTeacherIds.length > 0) {
        let sharedQuery = supabase
          .from("lists")
          .select(`
            id,
            title,
            updated_at,
            flashcards(id),
            folders(title, owner_id)
          `)
          .in("owner_id", allTeacherIds)
          .eq("visibility", "class")
          .order("updated_at", { ascending: false })
          .limit(10);
        
        if (institutionId) {
          sharedQuery = sharedQuery.eq("institution_id", institutionId);
        }
        
        const { data: sharedData } = await sharedQuery;
        sharedLists = toArray<any>(sharedData as any[]);
      }

      // Get teacher profiles with folder counts
      let teachersInfo: TeacherInfo[] = [];
      
      // First try RPC (for subscriptions)
      if (subscriptionTeacherIds.length > 0) {
        const { data: teacherData, error: teacherError } = await supabase.rpc(
          'get_subscribed_teachers_with_stats',
          { _student_id: userId }
        );
        
        if (!teacherError && teacherData) {
          teachersInfo = toArray<any>(teacherData as any[])
            .filter((t) => typeof t?.teacher_id === "string")
            .map((t) => ({
              id: t.teacher_id,
              name: toText(t.first_name, "Professor"),
              folder_count: toNumber(t.folder_count, 0),
            }));
        }
      }
      
      // Add teachers from turmas that aren't already in the list
      const existingTeacherIds = new Set(teachersInfo.map((t) => t.id));
      const missingTurmaTeacherIds = turmaTeacherIds.filter((id) => !existingTeacherIds.has(id));
      
      if (missingTurmaTeacherIds.length > 0) {
        // Fetch profiles for turma teachers
        const { data: turmaTeacherProfiles } = await supabase
          .from("profiles")
          .select("id, first_name")
          .in("id", missingTurmaTeacherIds);
        
        // Count folders for each
        for (const profile of toArray<any>(turmaTeacherProfiles as any[])) {
          if (typeof profile?.id !== "string") continue;

          const { count } = await supabase
            .from("folders")
            .select("*", { count: "exact", head: true })
            .eq("owner_id", profile.id)
            .eq("visibility", "class");
          
          teachersInfo.push({
            id: profile.id,
            name: toText(profile.first_name, "Professor"),
            folder_count: toNumber(count, 0),
          });
        }
      }

      // Process last session
      let lastSession: LastSession | null = null;
      const sessionData = sessionResult.data as any;
      if (sessionData && typeof sessionData.list_id === "string") {
        const cardsOrder = toArray<any>(sessionData.cards_order as any[]);
        const currentIndex = toNumber(sessionData.current_index, 0);
        const listRelation = Array.isArray(sessionData.lists) ? sessionData.lists[0] : sessionData.lists;

        lastSession = {
          id: sessionData.list_id,
          title: toText(listRelation?.title, "Sem título"),
          total: Math.max(0, cardsOrder.length),
          reviewed: Math.max(0, Math.min(currentIndex, cardsOrder.length)),
          mode: toText(sessionData.mode, "flip"),
        };
      }

      // Build activity map for ordering
      const activityMap = new Map<string, { studied: string | null; opened: string | null }>();
      toArray<any>(activityResult.data as any[]).forEach((a) => {
        if (typeof a?.list_id !== "string") return;
        activityMap.set(a.list_id, {
          studied: typeof a?.last_studied_at === "string" ? a.last_studied_at : null,
          opened: typeof a?.last_opened_at === "string" ? a.last_opened_at : null,
        });
      });

      const ownListsMapped = toArray<any>(ownListsResult.data as any[])
        .filter((list) => typeof list?.id === "string")
        .map((list) => {
          const activity = activityMap.get(list.id);
          const folderRel = Array.isArray(list?.folders) ? list.folders[0] : list?.folders;
          return {
            id: list.id,
            title: toText(list?.title, "Sem título"),
            count: Array.isArray(list?.flashcards) ? list.flashcards.length : 0,
            folder_name: toText(folderRel?.title, "Minhas Listas"),
            is_own: true,
            last_activity: activity?.studied || activity?.opened || list?.updated_at || null,
          };
        });

      const sharedListsMapped = toArray<any>(sharedLists)
        .filter((list) => typeof list?.id === "string")
        .map((list) => {
          const activity = activityMap.get(list.id);
          const folderRel = Array.isArray(list?.folders) ? list.folders[0] : list?.folders;
          return {
            id: list.id,
            title: toText(list?.title, "Sem título"),
            count: Array.isArray(list?.flashcards) ? list.flashcards.length : 0,
            folder_name: toText(folderRel?.title, "Compartilhado"),
            is_own: false,
            last_activity: activity?.studied || activity?.opened || list?.updated_at || null,
          };
        });

      // Sort by last_activity (most recent first)
      const allLists = [...ownListsMapped, ...sharedListsMapped]
        .sort((a, b) => {
          const dateA = a.last_activity ? new Date(a.last_activity).getTime() : 0;
          const dateB = b.last_activity ? new Date(b.last_activity).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 8);

      // Use accurate stats from dedicated count query
      const totalOwnLists = toNumber((statsCountResult as any)?.listCount, 0);
      const totalOwnCards = toNumber((statsCountResult as any)?.cardCount, 0);

      setData({
        last: lastSession,
        recents: allLists,
        teachers: toArray<TeacherInfo>(teachersInfo).slice(0, 3),
        stats: {
          total_lists: totalOwnLists,
          total_cards: totalOwnCards,
          teachers_count: allTeacherIds.length,
        },
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error loading home data:", error);
      setData({
        last: null,
        recents: [],
        teachers: [],
        stats: { total_lists: 0, total_cards: 0, teachers_count: 0 },
        loading: false,
        error: "Erro ao carregar dados",
      });
    }
  }, [selectedInstitution?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Also invalidate cache when refetching
  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['home-data'] });
    loadData();
  }, [loadData, queryClient]);

  return { ...data, refetch };
}
