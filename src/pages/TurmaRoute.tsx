import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, ExternalLink, Globe2, LogIn, UserPlus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PublicNav } from '@/components/seo/PublicNav';
import { SEOHead } from '@/components/seo/SEOHead';
import { useAuthUser } from '@/hooks/useAuthUser';
import { supabase } from '@/integrations/supabase/client';
import TurmaDetail from '@/pages/TurmaDetail';

interface PublicTurma {
  id: string;
  nome: string;
  descricao: string | null;
  created_at: string;
  teacher_name: string;
}

interface PublicAssignment {
  id: string;
  turma_id: string;
  titulo: string;
  descricao: string | null;
  fonte_tipo: string;
  card_count: number;
  order_index: number | null;
  created_at: string;
}

interface PublicTurmaPayload {
  turma: PublicTurma;
  atribuicoes: PublicAssignment[];
}

async function fetchPublicTurma(turmaId: string): Promise<PublicTurmaPayload | null> {
  const client = supabase as any;
  const [{ data: turma, error: turmaError }, { data: atribuicoes, error: atribuicoesError }] = await Promise.all([
    client
      .from('public_turmas')
      .select('id, nome, descricao, created_at, teacher_name')
      .eq('id', turmaId)
      .maybeSingle(),
    client
      .from('public_turma_atribuicoes')
      .select('id, turma_id, titulo, descricao, fonte_tipo, card_count, order_index, created_at')
      .eq('turma_id', turmaId)
      .order('order_index', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
  ]);

  if (turmaError) throw turmaError;
  if (!turma) return null;
  if (atribuicoesError) throw atribuicoesError;

  return {
    turma: turma as PublicTurma,
    atribuicoes: (atribuicoes ?? []) as PublicAssignment[],
  };
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <p className="text-muted-foreground">Carregando turma...</p>
    </div>
  );
}

function NotFoundState({ guest }: { guest: boolean }) {
  const navigate = useNavigate();
  return (
    <>
      {guest && <PublicNav />}
      <div className="min-h-[70vh] px-4 flex items-center justify-center">
        <Card className="max-w-lg w-full p-8 text-center space-y-4">
          <Globe2 className="h-10 w-10 mx-auto text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold">Turma não encontrada</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O link pode estar incorreto, a turma pode ser privada ou o acesso público foi desativado.
            </p>
          </div>
          <Button onClick={() => navigate(guest ? '/' : '/turmas')}>
            Voltar
          </Button>
        </Card>
      </div>
    </>
  );
}

function PublicTurmaView({ payload, guest }: { payload: PublicTurmaPayload; guest: boolean }) {
  const navigate = useNavigate();
  const { turma, atribuicoes } = payload;
  const description = (turma.descricao || `Turma pública de ${turma.teacher_name} no APE.`).slice(0, 160);

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEOHead
        title={`${turma.nome} - ${turma.teacher_name} | APE`}
        description={description}
        path={`/turmas/${turma.id}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Course',
          name: turma.nome,
          description,
          provider: {
            '@type': 'Organization',
            name: 'APE — Apprentice Practice & Enhancement',
          },
        }}
      />
      {guest && <PublicNav />}

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Voltar"
            onClick={() => navigate(guest ? '/' : '/turmas')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold break-words">{turma.nome}</h1>
              <Badge variant="secondary" className="gap-1">
                <Globe2 className="h-3 w-3" /> Pública
              </Badge>
            </div>
            {turma.descricao && (
              <p className="mt-1 text-sm text-muted-foreground max-w-3xl">{turma.descricao}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Professor: {turma.teacher_name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-5 border-primary/25 bg-primary/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Visualização pública — somente leitura</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Você pode consultar as atividades e os flashcards. Progresso, mensagens e ações da turma ficam bloqueados.
              </p>
            </div>
            {guest && (
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button variant="outline" onClick={() => navigate('/auth')}>
                  <LogIn className="h-4 w-4 mr-2" /> Entrar
                </Button>
                <Button onClick={() => navigate('/auth?mode=signup')}>
                  <UserPlus className="h-4 w-4 mr-2" /> Criar conta grátis
                </Button>
              </div>
            )}
          </div>
        </Card>

        <section aria-labelledby="public-assignments-title" className="space-y-4">
          <div>
            <h2 id="public-assignments-title" className="text-xl font-bold">Atividades da turma</h2>
            <p className="text-sm text-muted-foreground">
              {atribuicoes.length} {atribuicoes.length === 1 ? 'atividade publicada' : 'atividades publicadas'}
            </p>
          </div>

          {atribuicoes.length === 0 ? (
            <Card className="p-8 text-center">
              <BookOpen className="h-9 w-9 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma atividade foi publicada nesta turma ainda.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {atribuicoes.map((atribuicao) => (
                <Card key={atribuicao.id} className="p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg break-words">{atribuicao.titulo}</h3>
                      {atribuicao.descricao && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{atribuicao.descricao}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {atribuicao.fonte_tipo === 'pasta' ? 'Pasta' : 'Lista'}
                    </Badge>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                      {atribuicao.card_count ?? 0} cards
                    </span>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/turmas/${turma.id}/atribuicoes/${atribuicao.id}`)}
                    >
                      Abrir conteúdo <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function TurmaRoute() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const { user, isLoading: authLoading } = useAuthUser();

  const memberAccess = useQuery({
    queryKey: ['turma-access', turmaId, user?.id],
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

  const shouldLoadPublic = !!turmaId && !authLoading && (!user || (memberAccess.isFetched && !memberAccess.data));
  const publicTurma = useQuery({
    queryKey: ['public-turma', turmaId],
    queryFn: () => fetchPublicTurma(turmaId!),
    enabled: shouldLoadPublic,
    staleTime: 60_000,
    retry: 1,
  });

  if (authLoading || (user && memberAccess.isLoading)) {
    return <LoadingState />;
  }

  if (user && memberAccess.data) {
    return <TurmaDetail />;
  }

  if (publicTurma.isLoading) {
    return <LoadingState />;
  }

  if (!publicTurma.data) {
    return <NotFoundState guest={!user} />;
  }

  return <PublicTurmaView payload={publicTurma.data} guest={!user} />;
}
