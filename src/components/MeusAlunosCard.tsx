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
      className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => navigate('/professor/alunos')}
    >
      <div className="flex items-center gap-4">
        <Users className="h-8 w-8 text-primary" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold">Meus Alunos</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie seus alunos e atribuições
          </p>
        </div>
      </div>
    </Card>
  );
}
