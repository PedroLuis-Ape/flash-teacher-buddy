import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Globe2,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PublicNav } from '@/components/seo/PublicNav';
import { SEOHead } from '@/components/seo/SEOHead';
import {
  assignmentPositionLabel,
  sortAssignmentsByOrder,
} from '@/features/classroom/lib/assignmentOrder';
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
    atribuicoes: sortAssignmentsByOrder(
      (assignmentsResult.data ?? []) as PublicAssignment[],
    ),
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
    <Card className="border-primary/20 bg-card/95 p-3">
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
  const selectedPosition = selectedAssignmentId
    ? atribuicoes.findIndex((assignment) => assignment.id === selectedAssignmentId)
    : -1;
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
    <div className="min-h-screen bg-background pb-10 sm:pb-14">
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
        <div className="mx-auto flex max-w-6xl items-start gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label={selected ? 'Voltar à turma' : 'Voltar'}
            onClick={() => selected ? updatePublicSearchParams() : navigate(guest ? '/' : '/turmas')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {selected && selectedPosition >= 0 && (
                <Badge className="h-5 px-2 font-mono text-[10px] sm:h-auto sm:text-xs">
                  {assignmentPositionLabel(selectedPosition)}
                </Badge>
              )}
              <h1 className="break-words text-lg font-bold sm:text-2xl">
                {selected ? selected.assignment.titulo : turma.nome}
              </h1>
              <Badge variant="secondary" className="h-5 gap-1 px-2 text-[10px] sm:h-auto sm:text-xs">
                <Globe2 className="h-3 w-3" /> Público
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground sm:mt-1">
              Professor: {turma.teacher_name}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-3 py-3 sm:px-4 sm:py-4">
        {!selected ? (
          <section aria-labelledby="public-assignments-title" className="space-y-3 sm:space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary sm:text-sm sm:normal-case sm:tracking-normal">
                Escolha e comece
              </p>
              <h2 id="public-assignments-title" className="text-xl font-bold sm:text-2xl">
                Atividades da turma
              </h2>
              {turma.descricao && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{turma.descricao}</p>
              )}
            </div>

            {atribuicoes.length === 0 ? (
              <Card className="p-8 text-center">
                <BookOpen className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhuma atividade foi publicada nesta turma ainda.</p>
              </Card>
            ) : (
              <div className="grid gap-2.5 md:grid-cols-2 md:gap-3 xl:grid-cols-3">
                {atribuicoes.map((atribuicao, index) => {
                  const isFolder = atribuicao.fonte_tipo === 'pasta';
                  return (
                    <button
                      key={atribuicao.id}
                      type="button"
                      className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      onClick={() => updatePublicSearchParams(atribuicao.id)}
                      aria-label={`Abrir ${atribuicao.titulo}`}
                    >
                      <Card className="group h-full bg-card/95 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg md:p-4">
                        <div className="flex items-center gap-3 md:flex-col md:items-stretch md:gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 text-2xl shadow-sm md:h-12 md:w-12">
                            <span aria-hidden>{isFolder ? '\u{1F4C1}' : '\u{1F4DD}'}</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <Badge className="h-5 px-2 font-mono text-[10px]">
                                {assignmentPositionLabel(index)}
                              </Badge>
                              <span className="text-[11px] font-medium text-muted-foreground md:hidden">
                                {isFolder ? 'Pasta' : 'Atividade'}
                              </span>
                              <Badge variant="outline" className="hidden text-xs md:inline-flex">
                                {isFolder ? 'Pasta' : 'Atividade'}
                              </Badge>
                            </div>

                            <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug sm:text-base md:text-lg">
                              {atribuicao.titulo}
                            </h3>

                            {atribuicao.descricao && (
                              <p className="mt-1 hidden line-clamp-2 text-sm text-muted-foreground md:block">
                                {atribuicao.descricao}
                              </p>
                            )}

                            <div className="mt-1.5 flex items-center justify-between gap-3 md:mt-3 md:border-t md:pt-3">
                              <span className="text-xs text-muted-foreground md:text-sm">
                                {atribuicao.card_count ?? 0} cards
                              </span>
                              <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
                            </div>
                          </div>
                        </div>
                      </Card>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section aria-labelledby="public-lists-title" className="space-y-3 sm:space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary sm:text-sm sm:normal-case sm:tracking-normal">
                Escolha e jogue
              </p>
              <h2 id="public-lists-title" className="text-xl font-bold sm:text-2xl">
                Listas disponíveis
              </h2>
              {selected.assignment.descricao && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {selected.assignment.descricao}
                </p>
              )}
            </div>

            {selected.lists.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                Esta atividade ainda não possui listas públicas disponíveis.
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2 md:grid-cols-2 md:gap-3 xl:grid-cols-3">
                {selected.lists.map((list) => (
                  <button
                    key={list.list_id}
                    type="button"
                    className="h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    onClick={() => openGameHub(list.list_id)}
                    aria-label={`Escolher jogo para ${list.title}`}
                  >
                    <Card className="group flex h-full min-h-[126px] flex-col bg-card/95 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg sm:min-h-[138px] md:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-secondary/30 bg-secondary/20 text-xl shadow-sm md:h-11 md:w-11 md:text-2xl">
                          <span aria-hidden>{'\u{1F3AE}'}</span>
                        </div>
                        <Badge variant="secondary" className="h-5 px-2 text-[10px] md:text-xs">
                          Lista
                        </Badge>
                      </div>

                      <div className="mt-2.5 min-w-0 flex-1 md:mt-3">
                        <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug sm:text-base md:text-lg">
                          {list.title}
                        </h3>
                        {list.description && (
                          <p className="mt-1 hidden line-clamp-2 text-sm text-muted-foreground md:block">
                            {list.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2 text-xs font-semibold text-primary md:mt-3 md:text-sm">
                        <span>Escolher jogo</span>
                        <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
                      </div>
                    </Card>
                  </button>
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
