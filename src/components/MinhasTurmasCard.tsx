import { BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function MinhasTurmasCard() {
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
  if (!FEATURE_FLAGS.classes_enabled || !profile?.is_teacher) return null;

  return (
    <Card
      className="p-6 cursor-pointer hover:shadow-lg transition-all duration-200 border-border"
      onClick={() => navigate('/turmas')}
    >
      <div className="flex items-center gap-4">
        <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">Minhas Turmas</h3>
          <p className="text-sm text-muted-foreground truncate">
            Crie e gerencie suas turmas
          </p>
        </div>
      </div>
    </Card>
  );
}
