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
      const [sessionResult, ownListsResult, subscriptionsResult, activityResult, turmaTeachersResult] = await Promise.all([
        // Last study session
        supabase
          .from("study_sessions")
          .select(`
            list_id,
            mode,
            current_index,
            cards_order,
            lists (
              id,
              title
            )
          `)
          .eq("user_id", userId)
          .eq("completed", false)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),

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
          .select("turma_id, turmas(owner_teacher_id, nome)")
          .eq("user_id", userId)
          .eq("ativo", true)
      ]);

      // Get teacher IDs from subscriptions
      const subscriptionTeacherIds = (subscriptionsResult.data || []).map(s => s.teacher_id);
      
      // Get teacher IDs from turma_membros
      const turmaTeacherIds = (turmaTeachersResult.data || [])
        .map((m: any) => m.turmas?.owner_teacher_id)
        .filter(Boolean);
      
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
        sharedLists = sharedData || [];
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
          teachersInfo = (teacherData as any[]).map((t: any) => ({
            id: t.teacher_id,
            name: t.first_name || "Professor",
            folder_count: Number(t.folder_count) || 0,
          }));
        }
      }
      
      // Add teachers from turmas that aren't already in the list
      const existingTeacherIds = new Set(teachersInfo.map(t => t.id));
      const missingTurmaTeacherIds = turmaTeacherIds.filter((id: string) => !existingTeacherIds.has(id));
      
      if (missingTurmaTeacherIds.length > 0) {
        // Fetch profiles for turma teachers
        const { data: turmaTeacherProfiles } = await supabase
          .from("profiles")
          .select("id, first_name")
          .in("id", missingTurmaTeacherIds);
        
        // Count folders for each
        if (turmaTeacherProfiles) {
          for (const profile of turmaTeacherProfiles) {
            const { count } = await supabase
              .from("folders")
              .select("*", { count: "exact", head: true })
              .eq("owner_id", profile.id)
              .eq("visibility", "class");
            
            teachersInfo.push({
              id: profile.id,
              name: profile.first_name || "Professor",
              folder_count: count || 0,
            });
          }
        }
      }

      // Process last session
      let lastSession: LastSession | null = null;
      if (sessionResult.data && sessionResult.data.lists) {
        const cardsOrder = (sessionResult.data.cards_order as any[]) || [];
        const currentIndex = Number(sessionResult.data.current_index) || 0;
        lastSession = {
          id: sessionResult.data.list_id,
          title: (sessionResult.data.lists as any).title || "Sem título",
          total: Math.max(0, cardsOrder.length),
          reviewed: Math.max(0, Math.min(currentIndex, cardsOrder.length)),
          mode: sessionResult.data.mode || "flip",
        };
      }

      // Build activity map for ordering
      const activityMap = new Map<string, { studied: string | null; opened: string | null }>();
      (activityResult.data || []).forEach((a: any) => {
        activityMap.set(a.list_id, {
          studied: a.last_studied_at,
          opened: a.last_opened_at
        });
      });

      // Combine and sort all lists by activity
      const ownListsMapped = (ownListsResult.data || []).map((list: any) => {
        const activity = activityMap.get(list.id);
        return {
          id: list.id,
          title: list.title || "Sem título",
          count: list.flashcards?.length || 0,
          folder_name: list.folders?.title || "Minhas Listas",
          is_own: true,
          last_activity: activity?.studied || activity?.opened || list.updated_at,
        };
      });

      const sharedListsMapped = sharedLists.map((list: any) => {
        const activity = activityMap.get(list.id);
        return {
          id: list.id,
          title: list.title || "Sem título",
          count: list.flashcards?.length || 0,
          folder_name: list.folders?.title || "Compartilhado",
          is_own: false,
          last_activity: activity?.studied || activity?.opened || list.updated_at,
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

      // Calculate stats
      const totalOwnLists = ownListsMapped.length;
      const totalOwnCards = ownListsMapped.reduce((sum, list) => sum + list.count, 0);

      setData({
        last: lastSession,
        recents: allLists,
        teachers: teachersInfo.slice(0, 3),
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
