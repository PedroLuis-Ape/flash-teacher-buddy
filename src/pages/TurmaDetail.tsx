import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { resolveTurmaViewMode } from '@/features/classroom/lib/turmaAccess';
import { useAuthUser } from '@/hooks/useAuthUser';
import TurmaPrivateDetail from '@/pages/TurmaPrivateDetail';
import TurmaPublicPage from '@/pages/TurmaPublicPage';

export default function TurmaDetail() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const [searchParams] = useSearchParams();
  const { user, isLoading: authLoading } = useAuthUser();
  const publicPreview = searchParams.get('publicPreview') === 'true';

  const accessQuery = useQuery({
    queryKey: ['turma-access-gate', turmaId, user?.id, publicPreview],
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
    enabled: !!turmaId && !!user && !authLoading && !publicPreview,
    retry: false,
  });

  if (authLoading || (user && accessQuery.isLoading)) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando turma...</p>
      </div>
    );
  }

  const viewMode = resolveTurmaViewMode({
    publicPreview,
    authenticated: !!user,
    hasPrivateAccess: !!accessQuery.data,
  });

  return viewMode === 'private' ? <TurmaPrivateDetail /> : <TurmaPublicPage />;
}
