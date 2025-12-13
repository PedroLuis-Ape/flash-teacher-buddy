import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, UserCheck, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ErrorMessage } from '@/components/ErrorMessage';

export default function ProfessorProfile() {
  const { professorId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  // Fetch professor profile
  const { data: professor, isLoading: loadingProfile, error: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ['professor', professorId],
    queryFn: async () => {
      if (!professorId) throw new Error('Professor ID required');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, user_tag, public_access_enabled, avatar_skin_id')
        .eq('id', professorId)
        .eq('public_access_enabled', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Professor não encontrado');
      
      return data;
    },
    enabled: !!professorId && !!currentUserId,
    retry: 1,
  });

  // Check if subscribed
  const { data: isSubscribed, isLoading: loadingSubscription } = useQuery({
    queryKey: ['subscription', professorId, currentUserId],
    queryFn: async () => {
      if (!professorId || !currentUserId) return false;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('teacher_id', professorId)
        .eq('student_id', currentUserId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    },
    enabled: !!professorId && !!currentUserId,
  });

  // Count professor's folders
  const { data: folderCount } = useQuery({
    queryKey: ['professor-folders', professorId],
    queryFn: async () => {
      if (!professorId) return 0;

      // Exclude assignment copies - only count original public folders
      const { count, error } = await supabase
        .from('folders')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', professorId)
        .eq('visibility', 'class')
        .is('class_id', null);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!professorId,
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!professorId || !currentUserId) throw new Error('IDs inválidos');

      const { error } = await supabase
        .from('subscriptions')
        .insert({
          teacher_id: professorId,
          student_id: currentUserId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', professorId, currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['home-teachers'] });
      toast.success('Você agora segue este professor!');
    },
    onError: (error: any) => {
      console.error('Erro ao seguir professor:', error);
      toast.error('Erro ao seguir professor');
    },
  });

  // Unsubscribe mutation
  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      if (!professorId || !currentUserId) throw new Error('IDs inválidos');

      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('teacher_id', professorId)
        .eq('student_id', currentUserId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', professorId, currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['home-teachers'] });
      toast.success('Você deixou de seguir este professor');
    },
    onError: (error: any) => {
      console.error('Erro ao deixar de seguir:', error);
      toast.error('Erro ao deixar de seguir');
    },
  });

  const isLoading = loadingProfile || loadingSubscription;

  if (isLoading) {
    return <LoadingSpinner message="Carregando perfil do professor..." />;
  }

  if (profileError) {
    return (
      <ErrorMessage
        title="Erro ao carregar professor"
        message="Não foi possível carregar o perfil deste professor."
        onRetry={() => refetchProfile()}
        onGoBack={() => navigate(-1)}
      />
    );
  }

  if (!professor) {
    return (
      <ErrorMessage
        title="Professor não encontrado"
        message="Este professor não existe ou não está disponível."
        onGoBack={() => navigate('/search')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="max-w-6xl mx-auto p-4 lg:px-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Perfil do Professor</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 lg:px-8 space-y-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback>
                {professor.first_name?.[0]?.toUpperCase() || 'P'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{professor.first_name}</h2>
              <p className="text-muted-foreground">{professor.user_tag}</p>
              <div className="flex gap-4 mt-2">
                <Badge variant="outline">
                  <FolderOpen className="h-3 w-3 mr-1" />
                  {folderCount} pasta{folderCount !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
            {isSubscribed ? (
              <Button
                variant="outline"
                onClick={() => unsubscribeMutation.mutate()}
                disabled={unsubscribeMutation.isPending}
              >
                {unsubscribeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Seguindo
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => subscribeMutation.mutate()}
                disabled={subscribeMutation.isPending}
              >
                {subscribeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Seguir
                  </>
                )}
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Conteúdo Compartilhado</h3>
          {folderCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este professor ainda não compartilhou nenhuma pasta.
            </p>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/portal')}
            >
              Ver Conteúdo Compartilhado
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
