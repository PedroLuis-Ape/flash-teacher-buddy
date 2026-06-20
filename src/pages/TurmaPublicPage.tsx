import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FolderOpen,
  Gamepad2,
  Globe2,
  ListChecks,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PublicNav } from '@/components/seo/PublicNav';
import { SEOHead } from '@/components/seo/SEOHead';
import { buildPublicTurmaSearchParams } from '@/features/classroom/lib/turmaAccess';
import { useAuthUser } from '@/hooks/useAuthUser';
import { supabase } from '@/integrations/supabase/client';

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

interface PublicList {
  turma_id: string;
  atribuicao_id: string;
  list_id: string;
  title: string;
  description: string | null;
  order_index: number | null;
}

async function fetchPublicTurma(turmaId: string) {
  const client = supabase as any;
  const [turmaResult, assignmentsResult] = await Promise.all([
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

  if (turmaResult.error) throw turmaResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;
  if (!turmaResult.data) return null;

  return {
    turma: turmaResult.data as PublicTurma,
    atribuicoes: (assignmentsResult.data ?? []) as PublicAssignment[],
  };
}

async function fetchPublicAssignment(turmaId: string, assignmentId: string) {
  const client = supabase as any;
  const [assignmentResult, listsResult] = await Promise.all([
    client
      .from('public_turma_atribuicoes')
      .select('id, turma_id, titulo, descricao, fonte_tipo, card_count, order_index, created_at')
      .eq('turma_id', turmaId)
      .eq('id', assignmentId)
      .maybeSingle(),
    client
      .from('public_turma_lists')
      .select('turma_id, atribuicao_id, list_id, title, description, order_index')
      .eq('turma_id', turmaId)
      .eq('atribuicao_id', assignmentId)
      .order('order_index', { ascending: true, nullsFirst: false }),
  ]);

  if (assignmentResult.error) throw assignmentResult.error;
  if (listsResult.error) throw listsResult.error;
  if (!assignmentResult.data) return null;

  return {
    assignment: assignmentResult.data as PublicAssignment,
    lists: (listsResult.data ?? []) as PublicList[],
  };
}

function PublicCta({ guest }: { guest: boolean }) {
  const navigate = useNavigate();
  if (!guest) return null;

  return (
    <Card className="border-primary/20 bg-primary/5 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Jogue sem conta. Entre apenas para sincronizar progresso, favoritos e histórico.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/auth')}>
            <LogIn className="mr-2 h-4 w-4" /> Entrar
          </Button>
          <Button size="sm" onClick={() => navigate('/auth?mode=signup')}>
            <UserPlus className="mr-2 h-4 w-4" /> Criar conta
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function TurmaPublicPage() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthUser();
  const guest = !user;
  const selectedAssignmentId = searchParams.get('atribuicao');
  const publicPreview = searchParams.get('publicPreview') === 'true';

  const updatePublicSearchParams = (assignmentId?: string) => {
    setSearchParams(buildPublicTurmaSearchParams({ publicPreview, assignmentId }));
  };

  const openGameHub = (listId: string) => {
    const params = new URLSearchParams({
      guest: 'true',
      turma: turmaId!,
      atribuicao: selectedAssignmentId!,
    });
    navigate(`/portal/list/${listId}/games?${params.toString()}`);
  };

  const turmaQuery = useQuery({
    queryKey: ['public-turma', turmaId],
    queryFn: () => fetchPublicTurma(turmaId!),
    enabled: !!turmaId,
    staleTime: 60_000,
    retry: 1,
  });

  const assignmentQuery = useQuery({
    queryKey: ['public-turma-assignment', turmaId, selectedAssignmentId],
    queryFn: () => fetchPublicAssignment(turmaId!, selectedAssignmentId!),
    enabled: !!turmaId && !!selectedAssignmentId,
    staleTime: 60_000,
    retry: 1,
  });

  if (turmaQuery.isLoading || (selectedAssignmentId && assignmentQuery.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Carregando turma...</p>
      </div>
    );
  }

  if (!turmaQuery.data) {
    return (
      <>
        {guest && <PublicNav />}
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <Card className="w-full max-w-lg space-y-4 p-8 text-center">
            <Globe2 className="mx-auto h-10 w-10 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-bold">Turma não encontrada</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                O link pode estar incorreto, a turma pode ser privada ou o acesso público foi desativado.
              </p>
            </div>
            <Button onClick={() => navigate(guest ? '/' : '/turmas')}>Voltar</Button>
          </Card>
        </div>
      </>
    );
  }

  const { turma, atribuicoes } = turmaQuery.data;
  const selected = selectedAssignmentId ? assignmentQuery.data : null;
  const description = (
    selected?.assignment.descricao ||
    turma.descricao ||
    `Turma pública de ${turma.teacher_name} no APE.`
  ).slice(0, 160);

  if (selectedAssignmentId && !selected) {
    return (
      <>
        {guest && <PublicNav />}
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <Card className="w-full max-w-lg space-y-4 p-8 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-bold">Conteúdo indisponível</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Esta atividade pode ter sido removida ou a turma deixou de ser pública.
              </p>
            </div>
            <Button onClick={() => updatePublicSearchParams()}>Voltar à turma</Button>
          </Card>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-14">
      <SEOHead
        title={selected
          ? `${selected.assignment.titulo} - ${turma.nome} | APE`
          : `${turma.nome} - ${turma.teacher_name} | APE`}
        description={description}
        path={`/turmas/${turma.id}${selectedAssignmentId ? `?atribuicao=${selectedAssignmentId}` : ''}`}
        jsonLd={!selected ? {
          '@context': 'https://schema.org',
          '@type': 'Course',
          name: turma.nome,
          description,
          provider: {
            '@type': 'Organization',
            name: 'APE — Apprentice Practice & Enhancement',
          },
        } : undefined}
      />
      {guest && <PublicNav />}

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label={selected ? 'Voltar à turma' : 'Voltar'}
            onClick={() => selected ? updatePublicSearchParams() : navigate(guest ? '/' : '/turmas')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-xl font-bold sm:text-2xl">
                {selected ? selected.assignment.titulo : turma.nome}
              </h1>
              <Badge variant="secondary" className="gap-1">
                <Globe2 className="h-3 w-3" /> Público
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Professor: {turma.teacher_name}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        {!selected ? (
          <section aria-labelledby="public-assignments-title" className="space-y-4">
            <div>
              <p className="text-sm font-medium text-primary">Escolha e comece</p>
              <h2 id="public-assignments-title" className="text-2xl font-bold">Atividades da turma</h2>
              {turma.descricao && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{turma.descricao}</p>}
            </div>

            {atribuicoes.length === 0 ? (
              <Card className="p-8 text-center">
                <BookOpen className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhuma atividade foi publicada nesta turma ainda.</p>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {atribuicoes.map((atribuicao) => {
                  const isFolder = atribuicao.fonte_tipo === 'pasta';
                  const Icon = isFolder ? FolderOpen : ListChecks;
                  return (
                    <button
                      key={atribuicao.id}
                      type="button"
                      className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      onClick={() => updatePublicSearchParams(atribuicao.id)}
                    >
                      <Card className="group flex h-full flex-col gap-4 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg">
                        <div className="flex items-start justify-between gap-3">
                          <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                          <Badge variant="outline">{isFolder ? 'Pasta' : 'Atividade'}</Badge>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-lg font-semibold">{atribuicao.titulo}</h3>
                          {atribuicao.descricao && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{atribuicao.descricao}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t pt-3">
                          <span className="text-sm text-muted-foreground">{atribuicao.card_count ?? 0} cards</span>
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                            Abrir <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </span>
                        </div>
                      </Card>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section aria-labelledby="public-lists-title" className="space-y-4">
            <div>
              <p className="text-sm font-medium text-primary">Escolha e jogue</p>
              <h2 id="public-lists-title" className="text-2xl font-bold">Listas disponíveis</h2>
              {selected.assignment.descricao && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{selected.assignment.descricao}</p>
              )}
            </div>

            {selected.lists.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                Esta atividade ainda não possui listas públicas disponíveis.
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selected.lists.map((list) => (
                  <Card key={list.list_id} className="flex h-full flex-col gap-4 p-4 transition-all hover:border-primary/50 hover:shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary">
                        <Gamepad2 className="h-5 w-5" />
                      </div>
                      <Badge variant="secondary">Lista</Badge>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-lg font-semibold">{list.title}</h3>
                      {list.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{list.description}</p>
                      )}
                    </div>
                    <Button className="w-full" onClick={() => openGameHub(list.list_id)}>
                      <Gamepad2 className="mr-2 h-4 w-4" />
                      Escolher jogo
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        <PublicCta guest={guest} />
      </main>
    </div>
  );
}
