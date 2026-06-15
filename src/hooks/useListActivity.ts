import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';

/**
 * Hook to track user activity on lists (open/study).
 * Uses the centralized auth context and debouncing to avoid extra auth reads
 * and excessive database writes during a study session.
 */
export function useListActivity() {
  const { userId } = useAuthUser();
  const lastUpdateRef = useRef<Record<string, number>>({});
  const DEBOUNCE_MS = 30000;

  const trackListOpened = useCallback(async (listId: string) => {
    if (!listId || !userId) return;

    const now = Date.now();
    const key = `open_${listId}`;
    const lastUpdate = lastUpdateRef.current[key] || 0;
    if (now - lastUpdate < DEBOUNCE_MS) return;
    lastUpdateRef.current[key] = now;

    try {
      const { error } = await supabase
        .from('user_list_activity')
        .upsert({
          user_id: userId,
          list_id: listId,
          last_opened_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,list_id'
        });

      if (error) throw error;
    } catch (error) {
      // Permit a retry after a failed network write instead of suppressing the
      // event for the full debounce window.
      delete lastUpdateRef.current[key];
      console.error('[useListActivity] Error tracking open:', error);
    }
  }, [userId]);

  const trackListStudied = useCallback(async (listId: string) => {
    if (!listId || !userId) return;

    const now = Date.now();
    const key = `study_${listId}`;
    const lastUpdate = lastUpdateRef.current[key] || 0;
    if (now - lastUpdate < DEBOUNCE_MS) return;
    lastUpdateRef.current[key] = now;

    try {
      const { error } = await supabase
        .from('user_list_activity')
        .upsert({
          user_id: userId,
          list_id: listId,
          last_studied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,list_id'
        });

      if (error) throw error;
    } catch (error) {
      delete lastUpdateRef.current[key];
      console.error('[useListActivity] Error tracking study:', error);
    }
  }, [userId]);

  return { trackListOpened, trackListStudied };
}
