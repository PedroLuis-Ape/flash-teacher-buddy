import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

export default function MyTeachers() {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth', { replace: true });
        return;
      }
      setCurrentUserId(session.user.id);
    };
    loadUser();
  }, [navigate]);

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['my-teachers', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];

      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          teacher_id,
          created_at,
          profiles:teacher_id (
            id,
            first_name,
            user_tag,
            avatar_skin_id
          )
        `)
        .eq('student_id', currentUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map((sub: any) => ({
        id: sub.teacher_id,
        name: sub.profiles?.first_name || 'Professor',
        user_tag: sub.profiles?.user_tag || '',
        avatar_skin_id: sub.profiles?.avatar_skin_id,
        subscribed_at: sub.created_at,
      }));
    },
    enabled: !!currentUserId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Meus Professores</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {teachers.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Você ainda não segue nenhum professor
            </p>
            <Button onClick={() => navigate('/search')}>
              <Search className="h-4 w-4 mr-2" />
              Buscar Professores
            </Button>
          </Card>
        ) : (
          teachers.map((teacher) => (
            <Card
              key={teacher.id}
              className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/professores/${teacher.id}`)}
            >
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    {teacher.name?.[0]?.toUpperCase() || 'P'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold">{teacher.name}</h3>
                  <p className="text-sm text-muted-foreground">{teacher.user_tag}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
