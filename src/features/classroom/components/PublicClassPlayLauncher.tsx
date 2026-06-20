import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gamepad2, Play } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
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

type GuestMode =
  | 'flip'
  | 'write'
  | 'multiple-choice'
  | 'unscramble'
  | 'mixed'
  | 'pronunciation';

type GuestDirection = 'a-b' | 'b-a' | 'any';

interface PublicClassListRow {
  list_id: string;
  title: string;
  description: string | null;
  order_index: number | null;
}

function getPublicClassContext(pathname: string, search: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 2 || parts[0] !== 'turmas') return null;
  if (parts[1] === 'professor' || parts[1] === 'aluno') return null;

  const assignmentId = new URLSearchParams(search).get('atribuicao');
  if (!assignmentId) return null;

  return { turmaId: parts[1], assignmentId };
}

export function PublicClassPlayLauncher() {
  const location = useLocation();
  const navigate = useNavigate();
  const context = useMemo(
    () => getPublicClassContext(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const [mode, setMode] = useState<GuestMode>('flip');
  const [direction, setDirection] = useState<GuestDirection>('a-b');

  const listsQuery = useQuery({
    queryKey: ['public-class-play-lists', context?.turmaId, context?.assignmentId],
    queryFn: async () => {
      const client = supabase as any;
      const { data, error } = await client
        .from('public_turma_lists')
        .select('list_id, title, description, order_index')
        .eq('turma_id', context!.turmaId)
        .eq('atribuicao_id', context!.assignmentId)
        .order('order_index', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return (data ?? []) as PublicClassListRow[];
    },
    enabled: Boolean(context),
    staleTime: 60_000,
    retry: 1,
  });

  if (!context || listsQuery.isLoading || listsQuery.isError || !listsQuery.data?.length) {
    return null;
  }

  const startGuestGame = (listId: string) => {
    const params = new URLSearchParams({
      mode,
      dir: direction,
      order: 'random',
      turma: context.turmaId,
      atribuicao: context.assignmentId,
      guest: 'true',
    });

    navigate(`/portal/list/${listId}/study?${params.toString()}`);
  };

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-3xl border-primary/30 bg-background/95 p-4 shadow-2xl backdrop-blur md:bottom-6">
      <details open>
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
          <Gamepad2 className="h-5 w-5 text-primary" />
          Jogar esta atividade sem criar conta
        </summary>

        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium">Modo de jogo</label>
              <Select value={mode} onValueChange={(value) => setMode(value as GuestMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flip">Flashcards</SelectItem>
                  <SelectItem value="write">Escrita</SelectItem>
                  <SelectItem value="multiple-choice">Múltipla escolha</SelectItem>
                  <SelectItem value="unscramble">Organizar frase</SelectItem>
                  <SelectItem value="mixed">Modo misto</SelectItem>
                  <SelectItem value="pronunciation">Pronúncia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">Direção</label>
              <Select value={direction} onValueChange={(value) => setDirection(value as GuestDirection)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a-b">Lado A → Lado B</SelectItem>
                  <SelectItem value="b-a">Lado B → Lado A</SelectItem>
                  <SelectItem value="any">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
            {listsQuery.data.map((list) => (
              <div
                key={list.list_id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium break-words">{list.title}</p>
                  {list.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{list.description}</p>
                  )}
                </div>
                <Button className="shrink-0" onClick={() => startGuestGame(list.list_id)}>
                  <Play className="mr-2 h-4 w-4" />
                  Jogar agora
                </Button>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            O visitante joga normalmente. Progresso sincronizado, favoritos e histórico exigem uma conta.
          </p>
        </div>
      </details>
    </Card>
  );
}
