import { Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function MeusAlunosCard() {
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('profiles')
        .select('is_teacher')
        .eq('id', user.id)
        .single();

      return data;
    },
  });

  // Only show for teachers with feature enabled
  if (!FEATURE_FLAGS.meus_alunos_enabled || !profile?.is_teacher) return null;

  return (
    <Card
      className="p-6 cursor-pointer hover:shadow-lg transition-all duration-200 border-border"
      onClick={() => navigate('/professor/alunos')}
    >
      <div className="flex items-center gap-4">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate leading-tight">Meus Alunos</h3>
          <p className="text-sm text-muted-foreground truncate leading-tight mt-0.5">
            Gerencie seus alunos e atribuições
          </p>
        </div>
      </div>
    </Card>
  );
}
