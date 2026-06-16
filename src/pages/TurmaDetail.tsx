import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';
import TurmaPrivateDetail from '@/pages/TurmaPrivateDetail';
import TurmaPublicPage from '@/pages/TurmaPublicPage';

export default function TurmaDetail() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const { user, isLoading: authLoading } = useAuthUser();

  const accessQuery = useQuery({
    queryKey: ['turma-access-gate', turmaId, user?.id],
    queryFn: async () => {
      if (!turmaId || !user) return null;

      const { data, error } = await supabase
        .from('turmas')
        .select('id')
        .eq('id', turmaId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!turmaId && !!user && !authLoading,
    retry: false,
  });

  if (authLoading || (user && accessQuery.isLoading)) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando turma...</p>
      </div>
    );
  }

  if (user && accessQuery.data) {
    return <TurmaPrivateDetail />;
  }

  return <TurmaPublicPage />;
}
