import { Users, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function TurmasCard() {
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

  if (!FEATURE_FLAGS.classes_enabled) return null;

  const isTeacher = profile?.is_teacher || false;

  return (
    <Card
      className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => navigate('/turmas')}
    >
      <div className="flex items-center gap-4">
        {isTeacher ? (
          <Users className="h-8 w-8 text-primary" />
        ) : (
          <BookOpen className="h-8 w-8 text-primary" />
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold">
            {isTeacher ? 'Minhas Turmas' : 'Turmas'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isTeacher
              ? 'Gerencie turmas e atribuições'
              : 'Veja suas turmas e atribuições'}
          </p>
        </div>
      </div>
    </Card>
  );
}