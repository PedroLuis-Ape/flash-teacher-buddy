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
}

interface HomeData {
  last: LastSession | null;
  recents: RecentList[];
  loading: boolean;
  error: string | null;
}

export function useHomeData() {
  const [data, setData] = useState<HomeData>({
    last: null,
    recents: [],
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
        setData({ last: null, recents: [], loading: false, error: null });
        return;
      }

      const userId = session.user.id;

      // Fetch in parallel
      const [sessionResult, listsResult] = await Promise.all([
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

        // Recent lists
        supabase
          .from("lists")
          .select(`
            id,
            title,
            flashcards(id)
          `)
          .eq("owner_id", userId)
          .order("updated_at", { ascending: false })
          .limit(5),
      ]);

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

      // Process recent lists
      const recentLists: RecentList[] = (listsResult.data || []).map((list: any) => ({
        id: list.id,
        title: list.title || "Sem título",
        count: list.flashcards?.length || 0,
      }));

      setData({
        last: lastSession,
        recents: recentLists,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error loading home data:", error);
      setData({
        last: null,
        recents: [],
        loading: false,
        error: "Erro ao carregar dados",
      });
    }
  };

  return data;
}
