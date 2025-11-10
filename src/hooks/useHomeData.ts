import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
}

export function useHomeData() {
  const [data, setData] = useState<HomeData>({
    last: null,
    recents: [],
    teachers: [],
    stats: { total_lists: 0, total_cards: 0, teachers_count: 0 },
    loading: true,
    error: null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
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

        // Own lists
        supabase
          .from("lists")
          .select(`
            id,
            title,
            flashcards(id),
            folders(title)
          `)
          .eq("owner_id", userId)
          .order("updated_at", { ascending: false })
          .limit(10),

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
        const { data: sharedData } = await supabase
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
          // Count folders per teacher
          teachersInfo = await Promise.all(
            teacherProfiles.map(async (teacher) => {
              const { count } = await supabase
                .from("folders")
                .select("*", { count: "exact", head: true })
                .eq("owner_id", teacher.id)
                .eq("visibility", "class");

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
  };

  return data;
}
