import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Globe2, LogIn, UserPlus } from 'lucide-react';
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
  order_index: number;
}

interface PublicFlashcard {
  turma_id: string;
  atribuicao_id: string;
  list_id: string;
  id: string;
  term: string;
  translation: string;
  hint: string | null;
  example_text: string | null;
  example_translation: string | null;
  short_explanation: string | null;
  detailed_explanation: string | null;
  image_url_a: string | null;
  image_url_b: string | null;
  audio_url: string | null;
  created_at: string;
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
  const [assignmentResult, listsResult, cardsResult] = await Promise.all([
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
      .order('order_index', { ascending: true }),
    client
      .from('public_turma_flashcards')
      .select('turma_id, atribuicao_id, list_id, id, term, translation, hint, example_text, example_translation, short_explanation, detailed_explanation, image_url_a, image_url_b, audio_url, created_at')
      .eq('turma_id', turmaId)
      .eq('atribuicao_id', assignmentId)
      .order('created_at', { ascending: true }),
  ]);

  if (assignmentResult.error) throw assignmentResult.error;
  if (listsResult.error) throw listsResult.error;
  if (cardsResult.error) throw cardsResult.error;
  if (!assignmentResult.data) return null;

  const cardsByList = new Map<string, PublicFlashcard[]>();
  for (const card of (cardsResult.data ?? []) as PublicFlashcard[]) {
    const cards = cardsByList.get(card.list_id) ?? [];
    cards.push(card);
    cardsByList.set(card.list_id, cards);
  }

  return {
    assignment: assignmentResult.data as PublicAssignment,
    lists: ((listsResult.data ?? []) as PublicList[]).map((list) => ({
      ...list,
      cards: cardsByList.get(list.list_id) ?? [],
    })),
  };
}

function PublicCta({ guest }: { guest: boolean }) {
  const navigate = useNavigate();
  if (!guest) return null;

  return (
    <Card className="p-4 border-primary/25 bg-primary/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Crie uma conta gratuita para usar jogos, salvar progresso e montar suas próprias listas.
        </p>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => navigate('/auth')}>
            <LogIn className="h-4 w-4 mr-2" /> Entrar
          </Button>
          <Button size="sm" onClick={() => navigate('/auth?mode=signup')}>
            <UserPlus className="h-4 w-4 mr-2" /> Criar conta
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
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando turma...</p>
      </div>
    );
  }

  if (!turmaQuery.data) {
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
        <div className="min-h-[70vh] px-4 flex items-center justify-center">
          <Card className="max-w-lg w-full p-8 text-center space-y-4">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground" />
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
    <div className="min-h-screen bg-background pb-20">
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
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-start gap-3">
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
              <h1 className="text-2xl font-bold break-words">
                {selected ? selected.assignment.titulo : turma.nome}
              </h1>
              <Badge variant="secondary" className="gap-1">
                <Globe2 className="h-3 w-3" /> Somente leitura
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {turma.nome} · Professor: {turma.teacher_name}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <PublicCta guest={guest} />

        {!selected ? (
          <section aria-labelledby="public-assignments-title" className="space-y-4">
            <div>
              <h2 id="public-assignments-title" className="text-xl font-bold">Atividades da turma</h2>
              {turma.descricao && <p className="mt-1 text-sm text-muted-foreground">{turma.descricao}</p>}
              <p className="mt-1 text-sm text-muted-foreground">
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
                      <span className="text-sm text-muted-foreground">{atribuicao.card_count ?? 0} cards</span>
                      <Button size="sm" onClick={() => updatePublicSearchParams(atribuicao.id)}>
                        Abrir conteúdo
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-8">
            {selected.assignment.descricao && (
              <p className="text-sm text-muted-foreground">{selected.assignment.descricao}</p>
            )}
            {selected.lists.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                Esta atividade ainda não possui listas públicas disponíveis.
              </Card>
            ) : selected.lists.map((list) => (
              <section key={list.list_id} aria-labelledby={`list-${list.list_id}`} className="space-y-4">
                <div>
                  <h2 id={`list-${list.list_id}`} className="text-xl font-bold">{list.title}</h2>
                  {list.description && <p className="mt-1 text-sm text-muted-foreground">{list.description}</p>}
                </div>

                {list.cards.length === 0 ? (
                  <Card className="p-6 text-center text-muted-foreground">Nenhum card nesta lista.</Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {list.cards.map((card, index) => (
                      <Card key={card.id} className="p-5 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs uppercase tracking-wider text-muted-foreground">Card {index + 1}</span>
                          <Badge variant="outline">Flashcard</Badge>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">Inglês</p>
                            <p className="text-xl font-semibold break-words">{card.term}</p>
                          </div>
                          <div className="rounded-xl bg-muted/50 p-4">
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">Português</p>
                            <p className="mt-1 font-medium break-words">{card.translation}</p>
                          </div>
                        </div>
                        {card.hint && <p className="text-sm"><span className="font-medium">Dica:</span> {card.hint}</p>}
                        {card.short_explanation && <p className="text-sm text-muted-foreground">{card.short_explanation}</p>}
                        {card.detailed_explanation && (
                          <details className="rounded-lg border p-3 text-sm">
                            <summary className="cursor-pointer font-medium">Ver explicação detalhada</summary>
                            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{card.detailed_explanation}</p>
                          </details>
                        )}
                        {(card.example_text || card.example_translation) && (
                          <div className="border-l-2 border-primary/40 pl-3 text-sm space-y-1">
                            {card.example_text && <p>{card.example_text}</p>}
                            {card.example_translation && <p className="text-muted-foreground">{card.example_translation}</p>}
                          </div>
                        )}
                        {(card.image_url_a || card.image_url_b) && (
                          <div className="grid grid-cols-2 gap-2">
                            {card.image_url_a && (
                              <img src={card.image_url_a} alt="Ilustração do termo" loading="lazy" className="w-full rounded-lg border object-cover" />
                            )}
                            {card.image_url_b && (
                              <img src={card.image_url_b} alt="Ilustração da tradução" loading="lazy" className="w-full rounded-lg border object-cover" />
                            )}
                          </div>
                        )}
                        {card.audio_url && (
                          <audio controls preload="none" className="w-full" src={card.audio_url}>
                            Seu navegador não suporta áudio.
                          </audio>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
