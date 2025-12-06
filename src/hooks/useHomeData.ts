import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/contexts/InstitutionContext";

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
      const [sessionResult, ownListsResult, subscriptionsResult] = await Promise.all([
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

        // Own lists - filter by institution if selected, order by updated_at DESC (most recent)
        (() => {
          let query = supabase
            .from("lists")
            .select(`
              id,
              title,
              flashcards(id),
              folders(title)
            `)
            .eq("owner_id", userId)
            .order("updated_at", { ascending: false })
            .limit(10);
          
          if (institutionId) {
            query = query.eq("institution_id", institutionId);
          }
          
          return query;
        })(),

        // Subscriptions (teachers)
        supabase
          .from("subscriptions")
          .select("teacher_id")
          .eq("student_id", userId),
      ]);

      // Get teacher IDs
      const teacherIds = (subscriptionsResult.data || []).map(s => s.teacher_id);

      // Fetch shared lists from teachers if any
      let sharedLists: any[] = [];
      if (teacherIds.length > 0) {
        let sharedQuery = supabase
          .from("lists")
          .select(`
            id,
            title,
            flashcards(id),
            folders(title, owner_id)
          `)
          .in("owner_id", teacherIds)
          .eq("visibility", "class")
          .order("updated_at", { ascending: false })
          .limit(10);
        
        if (institutionId) {
          sharedQuery = sharedQuery.eq("institution_id", institutionId);
        }
        
        const { data: sharedData } = await sharedQuery;
        sharedLists = sharedData || [];
      }

      // Get teacher profiles
      let teachersInfo: TeacherInfo[] = [];
      if (teacherIds.length > 0) {
        const { data: teacherProfiles } = await supabase
          .from("profiles")
          .select("id, first_name")
          .in("id", teacherIds);

        if (teacherProfiles) {
          // Count folders per teacher - filter by institution if selected
          teachersInfo = await Promise.all(
            teacherProfiles.map(async (teacher) => {
              let folderQuery = supabase
                .from("folders")
                .select("*", { count: "exact", head: true })
                .eq("owner_id", teacher.id)
                .eq("visibility", "class");
              
              if (institutionId) {
                folderQuery = folderQuery.eq("institution_id", institutionId);
              }
              
              const { count } = await folderQuery;

              return {
                id: teacher.id,
                name: teacher.first_name || "Professor",
                folder_count: count || 0,
              };
            })
          );
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

      // Combine and sort all lists
      const ownListsMapped = (ownListsResult.data || []).map((list: any) => ({
        id: list.id,
        title: list.title || "Sem título",
        count: list.flashcards?.length || 0,
        folder_name: list.folders?.title || "Minhas Listas",
        is_own: true,
      }));

      const sharedListsMapped = sharedLists.map((list: any) => ({
        id: list.id,
        title: list.title || "Sem título",
        count: list.flashcards?.length || 0,
        folder_name: list.folders?.title || "Compartilhado",
        is_own: false,
      }));

      const allLists = [...ownListsMapped, ...sharedListsMapped]
        .sort((a, b) => b.count - a.count)
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
          teachers_count: teacherIds.length,
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

  return { ...data, refetch: loadData };
}
