import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TurmaActivityConfig {
  listId: string | undefined;
  mode: string;
  totalCards: number;
  currentIndex: number;
}

/**
 * Hook para rastrear atividade do aluno em turmas
 * Faz upsert periódico (a cada 15s max) na tabela turma_student_activity
 */
export function useTurmaActivity() {
  const turmaIdRef = useRef<string | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const configRef = useRef<TurmaActivityConfig | null>(null);

  const MIN_UPDATE_INTERVAL_MS = 15000; // 15 segundos entre updates

  /**
   * Inicializa o tracking descobrindo a turma_id da lista
   * Deve ser chamado uma vez no início da sessão
   */
  const initTurmaTracking = useCallback(async (listId: string | undefined) => {
    if (!listId) {
      turmaIdRef.current = null;
      return null;
    }

    try {
      // Buscar class_id da lista (se existir, é uma lista de atribuição)
      const { data: listData } = await supabase
        .from('lists')
        .select('class_id')
        .eq('id', listId)
        .single();

      if (listData?.class_id) {
        // Lista tem class_id, buscar turma_id correspondente
        // class_id na lista = id da turma (pois foi copiada para a turma)
        turmaIdRef.current = listData.class_id;
        return listData.class_id;
      }

      // Se lista não tem class_id, verificar se a pasta tem
      const { data: listWithFolder } = await supabase
        .from('lists')
        .select('folder_id, folders(class_id)')
        .eq('id', listId)
        .single();

      const folderClassId = (listWithFolder?.folders as any)?.class_id;
      if (folderClassId) {
        turmaIdRef.current = folderClassId;
        return folderClassId;
      }

      // Lista não pertence a nenhuma turma
      turmaIdRef.current = null;
      return null;
    } catch (error) {
      console.error('[useTurmaActivity] Error discovering turma_id:', error);
      turmaIdRef.current = null;
      return null;
    }
  }, []);

  /**
   * Atualiza atividade na turma (debounced)
   */
  const updateTurmaActivity = useCallback(async (config: TurmaActivityConfig) => {
    configRef.current = config;
    const turmaId = turmaIdRef.current;
    
    // Só atualiza se tiver turma_id
    if (!turmaId || !config.listId) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    // Se passou tempo suficiente, atualiza imediatamente
    if (timeSinceLastUpdate >= MIN_UPDATE_INTERVAL_MS) {
      await performUpdate(turmaId, config);
      return;
    }

    // Senão, agenda um update para quando completar o intervalo
    if (!updateTimeoutRef.current) {
      const remainingTime = MIN_UPDATE_INTERVAL_MS - timeSinceLastUpdate;
      updateTimeoutRef.current = setTimeout(async () => {
        updateTimeoutRef.current = null;
        if (configRef.current && turmaIdRef.current) {
          await performUpdate(turmaIdRef.current, configRef.current);
        }
      }, remainingTime);
    }
  }, []);

  /**
   * Executa o update real no banco
   */
  const performUpdate = async (turmaId: string, config: TurmaActivityConfig) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const progressPct = config.totalCards > 0 
        ? Math.round(((config.currentIndex + 1) / config.totalCards) * 100)
        : 0;

      // Usar tipo genérico para evitar erro de types desatualizados
      const { error } = await supabase
        .from('turma_student_activity' as any)
        .upsert({
          turma_id: turmaId,
          student_id: user.id,
          list_id: config.listId,
          mode: config.mode,
          progress_pct: progressPct,
          last_activity_at: new Date().toISOString(),
        }, {
          onConflict: 'turma_id,student_id'
        });

      if (error) {
        console.error('[useTurmaActivity] Update error:', error);
      } else {
        lastUpdateRef.current = Date.now();
        console.log('[useTurmaActivity] Updated activity for turma:', turmaId, 'progress:', progressPct);
      }
    } catch (error) {
      console.error('[useTurmaActivity] Error updating activity:', error);
    }
  };

  /**
   * Flush final - garante que última atividade seja gravada
   * Chamar no cleanup/unmount
   */
  const flushActivity = useCallback(async () => {
    // Cancelar timeout pendente
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    // Fazer update imediato se tiver dados pendentes
    const turmaId = turmaIdRef.current;
    const config = configRef.current;
    
    if (turmaId && config?.listId) {
      await performUpdate(turmaId, config);
    }
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      // Não fazemos flush no cleanup porque pode causar race conditions
      // O update periódico já garante dados recentes
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
