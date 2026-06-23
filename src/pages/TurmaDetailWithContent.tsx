import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { resolveTurmaViewMode } from '@/features/classroom/lib/turmaAccess';
import { AssignmentOrderManager } from '@/features/classroom/components/AssignmentOrderManager';
import { ClassroomContentToolbar } from '@/features/classroom/components/ClassroomContentToolbar';
import { ClassroomSuperImportLaunchCard } from '@/features/classroom/components/ClassroomSuperImportLaunchCard';
import { TeacherClassNavigation } from '@/features/classroom/components/TeacherClassNavigation';
import { useAuthUser } from '@/hooks/useAuthUser';
import TurmaPrivateDetail from '@/pages/TurmaPrivateDetail';
import TurmaPublicPage from '@/pages/TurmaPublicPage';

export default function TurmaDetailWithContent() {
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
        .select('id, owner_teacher_id')
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

  if (viewMode === 'private') {
    const isOwner = Boolean(user && accessQuery.data?.owner_teacher_id === user.id);
    return (
      <>
        {isOwner && <TeacherClassNavigation />}
        {isOwner && turmaId && <ClassroomContentToolbar turmaId={turmaId} />}
        {isOwner && turmaId && <ClassroomSuperImportLaunchCard turmaId={turmaId} />}
        <div data-classroom-assignments>
          <TurmaPrivateDetail />
        </div>
        {isOwner && turmaId && <AssignmentOrderManager turmaId={turmaId} />}
      </>
    );
  }

  return <TurmaPublicPage />;
}
