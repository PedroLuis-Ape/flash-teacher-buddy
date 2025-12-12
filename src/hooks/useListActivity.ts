import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to track user activity on lists (open/study)
 * Uses debouncing to avoid excessive DB writes
 */
export function useListActivity() {
  const lastUpdateRef = useRef<Record<string, number>>({});
  const DEBOUNCE_MS = 30000; // 30 seconds minimum between updates per list

  const trackListOpened = useCallback(async (listId: string) => {
    if (!listId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Debounce check
      const now = Date.now();
      const lastUpdate = lastUpdateRef.current[`open_${listId}`] || 0;
      if (now - lastUpdate < DEBOUNCE_MS) return;
      lastUpdateRef.current[`open_${listId}`] = now;

      await supabase
        .from('user_list_activity')
        .upsert({
          user_id: user.id,
          list_id: listId,
          last_opened_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,list_id'
        });
    } catch (error) {
      console.error('[useListActivity] Error tracking open:', error);
    }
  }, []);

  const trackListStudied = useCallback(async (listId: string) => {
    if (!listId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Debounce check
      const now = Date.now();
      const lastUpdate = lastUpdateRef.current[`study_${listId}`] || 0;
      if (now - lastUpdate < DEBOUNCE_MS) return;
      lastUpdateRef.current[`study_${listId}`] = now;

      await supabase
        .from('user_list_activity')
        .upsert({
          user_id: user.id,
          list_id: listId,
          last_studied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,list_id'
        });
    } catch (error) {
      console.error('[useListActivity] Error tracking study:', error);
    }
  }, []);

  return { trackListOpened, trackListStudied };
}
