import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Gamepad2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizeDirection, type Direction } from '@/features/study/lib/gameCore';
import { normalizeStudyMode, studyModeToUrlParam, type StudyMode } from '@/features/study/lib/studyMode';
import {
  GAME_MODE_VISUALS,
  type GameModeVisualKey,
} from '@/features/study/lib/gameModeVisuals';
import { cn } from '@/lib/utils';

interface PublicClassListMeta {
  list_id: string;
  title: string;
  description: string | null;
}

type StudyOrder = 'random' | 'sequential';

const gameOptions: Array<{
  mode: StudyMode | 'multiple';
  visualKey: GameModeVisualKey;
  title: string;
  description: string;
  recommended?: boolean;
}> = [
  {
    mode: 'flip',
    visualKey: 'flip',
    title: 'Virar Cartas',
    description: 'Revise os dois lados dos flashcards.',
  },
  {
    mode: 'write',
    visualKey: 'write',
    title: 'Escrever',
    description: 'Digite a resposta e confira na hora.',
  },
  {
    mode: 'multiple',
    visualKey: 'multiple',
    title: 'Múltipla Escolha',
    description: 'Escolha a alternativa correta.',
  },
  {
    mode: 'unscramble',
    visualKey: 'unscramble',
    title: 'Organizar Frase',
    description: 'Coloque as palavras na ordem correta.',
  },
  {
    mode: 'mixed',
    visualKey: 'mixed',
    title: 'Prática Mista',
    description: 'Rodadas curtas, três corações e revisão dos erros.',
    recommended: true,
  },
  {
    mode: 'pronunciation',
    visualKey: 'pronunciation',
    title: 'Pronúncia',
    description: 'Pratique falando em voz alta.',
  },
];

export default function PublicClassGamesHub() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const turmaId = searchParams.get('turma');
  const assignmentId = searchParams.get('atribuicao');
  const [direction, setDirection] = useState<Direction>('any');
  const [order, setOrder] = useState<StudyOrder>('random');

  const validContext = Boolean(id && turmaId && assignmentId);

  const listQuery = useQuery({
    queryKey: ['public-class-game-hub', turmaId, assignmentId, id],
    queryFn: async () => {
      const client = supabase as any;
      const { data, error } = await client
        .from('public_turma_lists')
        .select('list_id, title, description')
        .eq('turma_id', turmaId!)
        .eq('atribuicao_id', assignmentId!)
        .eq('list_id', id!)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as PublicClassListMeta | null;
    },
    enabled: validContext,
    staleTime: 60_000,
    retry: 1,
  });

  const backPath = useMemo(() => {
    if (!turmaId) return '/portal';
    return assignmentId
      ? `/turmas/${turmaId}?atribuicao=${assignmentId}`
      : `/turmas/${turmaId}`;
  }, [turmaId, assignmentId]);

  const startGame = (rawMode: StudyMode | 'multiple') => {
    if (!id || !turmaId || !assignmentId) return;
    const mode = normalizeStudyMode(rawMode);

    if (mode === 'mixed') {
      const mixedParams = new URLSearchParams({
        dir: direction,
        guest: 'true',
        turma: turmaId,
        atribuicao: assignmentId,
      });
      navigate(`/portal/list/${id}/mixed-study?${mixedParams.toString()}`);
      return;
    }

    const params = new URLSearchParams({
      mode: studyModeToUrlParam(mode),
      dir: direction,
      order,
      guest: 'true',
      turma: turmaId,
      atribuicao: assignmentId,
    });

    navigate(`/portal/list/${id}/study?${params.toString()}`);
  };

  if (!validContext) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-4">
        <Card className="max-w-lg space-y-4 p-8 text-center">
          <Gamepad2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-bold">Hub público indisponível</h1>
          <p className="text-sm text-muted-foreground">
            Volte à turma pública e escolha uma lista novamente.
          </p>
          <Button onClick={() => navigate('/portal')}>Voltar ao portal</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(backPath)} className="mb-3 sm:mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar às listas
        </Button>

        <section className="mb-4 rounded-2xl border border-primary/25 bg-card/95 p-4 shadow-sm sm:mb-8 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-wide text-primary sm:text-sm sm:normal-case sm:tracking-normal">
            Área pública do aluno
          </p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Hub de jogos</h1>
          {listQuery.isLoading ? (
            <Skeleton className="mt-2 h-5 w-64" />
          ) : listQuery.data ? (
            <div className="mt-2 max-w-3xl sm:mt-3">
              <h2 className="line-clamp-2 text-base font-semibold sm:text-xl">{listQuery.data.title}</h2>
              {listQuery.data.description && (
                <p className="mt-1 hidden text-muted-foreground sm:block">{listQuery.data.description}</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-muted-foreground">Esta lista não está mais disponível publicamente.</p>
          )}
        </section>

        <section className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card/95 p-3 shadow-sm sm:p-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium sm:mb-2 sm:text-sm">Direção</label>
              <Select value={direction} onValueChange={(value) => setDirection(normalizeDirection(value))}>
                <SelectTrigger className="h-10 sm:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a-b">Lado A → Lado B</SelectItem>
                  <SelectItem value="b-a">Lado B → Lado A</SelectItem>
                  <SelectItem value="any">Alternar lados (padrão)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium sm:mb-2 sm:text-sm">Ordem dos cards</label>
              <Select value={order} onValueChange={(value) => setOrder(value as StudyOrder)}>
                <SelectTrigger className="h-10 sm:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Aleatória</SelectItem>
                  <SelectItem value="sequential">Sequencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="mb-3 sm:mb-4">
              <p className="text-xs font-medium uppercase tracking-wide text-primary sm:text-sm sm:normal-case sm:tracking-normal">
                Escolha como jogar
              </p>
              <h2 className="text-xl font-bold sm:text-2xl">Modos disponíveis</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {gameOptions.map(({ mode, visualKey, title, description, recommended }) => {
                const visual = GAME_MODE_VISUALS[visualKey];
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={!listQuery.data}
                    onClick={() => startGame(mode)}
                    className={cn(
                      'group relative flex min-h-[116px] flex-col items-start justify-between rounded-2xl border p-3 text-left shadow-sm transition-all',
                      'hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50',
                      'sm:min-h-40 sm:p-5',
                      recommended && 'border-primary/60 ring-2 ring-primary/15',
                      visual.cardClass,
                    )}
                  >
                    {recommended && (
                      <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-extrabold text-primary-foreground shadow-sm">
                        RECOMENDADO
                      </span>
                    )}
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-2xl border text-2xl shadow-sm sm:h-13 sm:w-13 sm:text-3xl',
                        visual.tileClass,
                      )}
                      aria-hidden="true"
                      title={visual.emojiLabel}
                    >
                      {visual.emoji}
                    </div>
                    <div className="mt-3 min-w-0 sm:mt-5">
                      <h3 className="text-sm font-bold leading-tight sm:text-lg">{title}</h3>
                      <p className="mt-1 hidden text-sm text-muted-foreground sm:block">{description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Card className="bg-card/95 p-4 text-sm text-muted-foreground shadow-sm">
            Você pode jogar sem conta. Uma conta é necessária apenas para sincronizar progresso, favoritos e histórico.
          </Card>
        </section>
      </main>
    </div>
  );
}
