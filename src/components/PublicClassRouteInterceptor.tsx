import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useAuthUser } from '@/hooks/useAuthUser';
import { supabase } from '@/integrations/supabase/client';
import TurmaPublicPage from '@/pages/TurmaPublicPage';

interface PublicClassRouteInterceptorProps {
  children: ReactNode;
}

function getClassId(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 2 || parts[0] !== 'turmas') return null;
  if (parts[1] === 'professor' || parts[1] === 'aluno') return null;
  return parts[1];
}

export function PublicClassRouteInterceptor({ children }: PublicClassRouteInterceptorProps) {
  const { pathname } = useLocation();
  const turmaId = getClassId(pathname);
  const { user, isLoading: authLoading } = useAuthUser();

  const accessQuery = useQuery({
    queryKey: ['turma-route-access', turmaId, user?.id],
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

  if (!turmaId) return <>{children}</>;

  if (authLoading || (user && accessQuery.isLoading)) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando turma...</p>
      </div>
    );
  }

  if (user && accessQuery.data) return <>{children}</>;

  return (
    <Routes>
      <Route path="/turmas/:turmaId" element={<TurmaPublicPage />} />
    </Routes>
  );
}
