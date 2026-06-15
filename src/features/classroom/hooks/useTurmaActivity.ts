import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';

interface TurmaActivityConfig {
  listId: string | undefined;
  mode: string;
  totalCards: number;
  currentIndex: number;
}

const MIN_UPDATE_INTERVAL_MS = 15000;

/**
 * Tracks student activity in classes with a maximum write cadence of once
 * every 15 seconds. Authentication comes from the central provider, so card
 * answers do not trigger extra Supabase auth requests.
 */
export function useTurmaActivity() {
  const { userId } = useAuthUser();
  const turmaIdRef = useRef<string | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const configRef = useRef<TurmaActivityConfig | null>(null);

  const initTurmaTracking = useCallback(async (listId: string | undefined) => {
    if (!listId) {
      turmaIdRef.current = null;
      return null;
    }

    try {
      // One joined query replaces the previous list lookup followed by a
      // second list/folder lookup when class_id was empty.
      const { data, error } = await supabase
        .from('lists')
        .select('class_id, folder_id, folders(class_id)')
        .eq('id', listId)
        .maybeSingle();

      if (error) throw error;

      const directClassId = data?.class_id ?? null;
      const folderClassId = (data?.folders as { class_id?: string | null } | null)?.class_id ?? null;
      const turmaId = directClassId || folderClassId;
      turmaIdRef.current = turmaId;
      return turmaId;
    } catch (error) {
      console.error('[useTurmaActivity] Error discovering turma_id:', error);
      turmaIdRef.current = null;
      return null;
    }
  }, []);

  const performUpdate = useCallback(async (turmaId: string, config: TurmaActivityConfig) => {
    if (!userId || !config.listId) return;

    try {
      const progressPct = config.totalCards > 0
        ? Math.round(((config.currentIndex + 1) / config.totalCards) * 100)
        : 0;

      const { error } = await supabase
        .from('turma_student_activity' as any)
        .upsert({
          turma_id: turmaId,
          student_id: userId,
          list_id: config.listId,
          mode: config.mode,
          progress_pct: progressPct,
          last_activity_at: new Date().toISOString(),
        }, {
          onConflict: 'turma_id,student_id'
        });

      if (error) throw error;
      lastUpdateRef.current = Date.now();
    } catch (error) {
      console.error('[useTurmaActivity] Error updating activity:', error);
    }
  }, [userId]);

  const updateTurmaActivity = useCallback(async (config: TurmaActivityConfig) => {
    configRef.current = config;
    const turmaId = turmaIdRef.current;
    if (!turmaId || !config.listId || !userId) return;

    const elapsed = Date.now() - lastUpdateRef.current;
    if (elapsed >= MIN_UPDATE_INTERVAL_MS) {
      await performUpdate(turmaId, config);
      return;
    }

    if (!updateTimeoutRef.current) {
      updateTimeoutRef.current = setTimeout(async () => {
        updateTimeoutRef.current = null;
        if (configRef.current && turmaIdRef.current) {
          await performUpdate(turmaIdRef.current, configRef.current);
        }
      }, MIN_UPDATE_INTERVAL_MS - elapsed);
    }
  }, [performUpdate, userId]);

  const flushActivity = useCallback(async () => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    const turmaId = turmaIdRef.current;
    const config = configRef.current;
    if (turmaId && config?.listId && userId) {
      await performUpdate(turmaId, config);
    }
  }, [performUpdate, userId]);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return {
    initTurmaTracking,
    updateTurmaActivity,
    flushActivity,
    hasTurma: () => turmaIdRef.current !== null,
    getTurmaId: () => turmaIdRef.current,
  };
}
