import { Users, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useScrollReveal } from '@/hooks/useScrollReveal';

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
  
  // Don't show for teachers (they have separate cards)
  if (isTeacher) return null;

  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <Card
      ref={revealRef}
      className="scroll-reveal card-3d p-6 cursor-pointer transition-all duration-200 border-border"
      onClick={() => navigate('/turmas')}
    >
      <div className="flex items-center gap-4">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          {isTeacher ? (
            <Users className="h-6 w-6 text-primary" />
          ) : (
            <BookOpen className="h-6 w-6 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate leading-tight">
            {isTeacher ? 'Minhas Turmas' : 'Turmas'}
          </h3>
          <p className="text-sm text-muted-foreground truncate leading-tight mt-0.5">
            {isTeacher
              ? 'Gerencie turmas e atribuições'
              : 'Veja suas turmas e atribuições'}
          </p>
        </div>
      </div>
    </Card>
  );
}