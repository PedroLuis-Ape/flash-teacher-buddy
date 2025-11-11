import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Class {
  id: string;
  name: string;
  code: string;
  role: 'teacher' | 'student';
  joined_at: string;
  is_owner: boolean;
  unread_count: number;
}

export function useClasses() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Você precisa estar logado.');
        return;
      }

      const response = await supabase.functions.invoke('classes-mine', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.success) {
        setClasses(response.data.classes || []);
      } else {
        throw new Error(response.data?.message || 'Erro ao buscar turmas');
      }
    } catch (err: any) {
      console.error('Error fetching classes:', err);
      setError(err.message || 'Erro ao buscar turmas');
      toast.error(err.message || 'Erro ao buscar turmas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const createClass = async (name: string, visibility: 'private' | 'code' = 'code') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar logado.');
        return null;
      }

      const response = await supabase.functions.invoke('classes-create', {
        body: { name, visibility },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.success) {
        toast.success('Turma criada com sucesso!');
        await fetchClasses();
        return response.data.class;
      } else {
        throw new Error(response.data?.message || 'Erro ao criar turma');
      }
    } catch (err: any) {
      console.error('Error creating class:', err);
      toast.error(err.message || 'Erro ao criar turma');
      return null;
    }
  };

  const joinClass = async (code: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar logado.');
        return null;
      }

      const response = await supabase.functions.invoke('classes-join', {
        body: { code },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.success) {
        if (response.data.already_member) {
          toast.info('Você já é membro desta turma!');
        } else {
          toast.success('Você entrou na turma!');
        }
        await fetchClasses();
        return response.data.class;
      } else {
        throw new Error(response.data?.message || 'Código inválido ou turma indisponível.');
      }
    } catch (err: any) {
      console.error('Error joining class:', err);
      toast.error(err.message || 'Código inválido ou turma indisponível.');
      return null;
    }
  };

  return {
    classes,
    loading,
    error,
    createClass,
    joinClass,
    refetch: fetchClasses,
  };
}
