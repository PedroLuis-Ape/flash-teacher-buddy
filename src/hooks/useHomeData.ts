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
              folders(title)
            `)
            .eq("owner_id", userId)
            .is("class_id", null)
            .is("deleted_at", null)
            .order("updated_at", { ascending: false })
            .limit(20);
          
          if (institutionId) {
            query = query.eq("institution_id", institutionId);
          } else {
            query = query.is("institution_id", null);
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

        // Accurate stats: count lists (head-only) + card counts via RPC
        (async () => {
          let listCountQuery = supabase
            .from("lists")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", userId)
            .is("class_id", null)
            .is("deleted_at", null);

          if (institutionId) {
            listCountQuery = listCountQuery.eq("institution_id", institutionId);
          } else {
            listCountQuery = listCountQuery.is("institution_id", null);
          }

          const [{ count: listCount }, cardCountsResult] = await Promise.all([
            listCountQuery,
            supabase.rpc('get_user_card_counts', {
              _user_id: userId,
              _institution_id: institutionId,
            }),
          ]);

          // Sum all per-list card counts for total
          const cardCountRows = toArray<any>(cardCountsResult.data as any[]);
          const totalCards = cardCountRows.reduce((sum: number, r: any) => sum + toNumber(r.card_count, 0), 0);

          // Build per-list count map for recents
          const perListCardCounts: Record<string, number> = {};
          for (const r of cardCountRows) {
            if (typeof r?.list_id === "string") {
              perListCardCounts[r.list_id] = toNumber(r.card_count, 0);
            }
          }

          return { listCount: listCount || 0, cardCount: totalCards, perListCardCounts };
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
            folders(title, owner_id),
            flashcards(count)
          `)
          .in("owner_id", allTeacherIds)
          .eq("visibility", "class")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(10);

        if (institutionId) {
          sharedQuery = sharedQuery.eq("institution_id", institutionId);
        } else {
          sharedQuery = sharedQuery.is("institution_id", null);
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
        // Fetch profiles AND folder counts in parallel (single queries, no N+1 loop)
        const [profilesResult, foldersResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, first_name")
            .in("id", missingTurmaTeacherIds),
          supabase
            .from("folders")
            .select("owner_id")
            .in("owner_id", missingTurmaTeacherIds)
            .eq("visibility", "class"),
        ]);

        // Aggregate folder counts client-side
        const folderCountMap = toArray<any>(foldersResult.data as any[]).reduce(
          (acc: Record<string, number>, f: any) => {
            if (typeof f?.owner_id === "string") {
              acc[f.owner_id] = (acc[f.owner_id] || 0) + 1;
            }
            return acc;
          },
          {} as Record<string, number>
        );

        for (const profile of toArray<any>(profilesResult.data as any[])) {
          if (typeof profile?.id !== "string") continue;
          teachersInfo.push({
            id: profile.id,
            name: toText(profile.first_name, "Professor"),
            folder_count: toNumber(folderCountMap[profile.id], 0),
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

      // ── PERF: Use per-list card counts from RPC (zero extra network calls) ──
      const perListCardCounts = (statsCountResult as any)?.perListCardCounts || {};

      const ownListsMapped = toArray<any>(ownListsResult.data as any[])
        .filter((list) => typeof list?.id === "string")
        .map((list) => {
          const activity = activityMap.get(list.id);
          const folderRel = Array.isArray(list?.folders) ? list.folders[0] : list?.folders;
          return {
            id: list.id,
            title: toText(list?.title, "Sem título"),
            count: toNumber(perListCardCounts[list.id], 0),
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
          const flashcardRel = Array.isArray(list?.flashcards) ? list.flashcards[0] : list?.flashcards;
          return {
            id: list.id,
            title: toText(list?.title, "Sem título"),
            count: toNumber(flashcardRel?.count, 0),
            folder_name: toText(folderRel?.title, "Compartilhado"),
            is_own: false,
            last_activity: activity?.studied || activity?.opened || list?.updated_at || null,
          };
        });

      // Sort by last_activity (most recent first), limit to 5
      const allLists = [...ownListsMapped, ...sharedListsMapped]
        .sort((a, b) => {
          const dateA = a.last_activity ? new Date(a.last_activity).getTime() : 0;
          const dateB = b.last_activity ? new Date(b.last_activity).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 5);

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
