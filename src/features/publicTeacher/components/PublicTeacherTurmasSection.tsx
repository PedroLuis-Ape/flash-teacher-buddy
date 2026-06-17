import { BookOpen, ListChecks, School } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface PublicTeacherTurmaRow {
  id: string;
  nome: string;
  descricao: string | null;
  created_at: string;
  assignment_count: number | string;
  card_count: number | string;
}

export const PUBLIC_TEACHER_STATS_GRID_CLASS =
  'mt-6 grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-4';

function asNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function pluralizeCount(
  value: number | string | null | undefined,
  singular: string,
  plural: string,
) {
  const count = asNumber(value);
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildPublicTurmaPath(turmaId: string) {
  return `/turmas/${turmaId}`;
}

export function getPublicTurmasSectionState(input: {
  isLoading: boolean;
  isError: boolean;
  count: number;
}) {
  if (input.isLoading) return 'loading' as const;
  if (input.isError) return 'error' as const;
  if (input.count === 0) return 'empty' as const;
  return 'ready' as const;
}

interface PublicTeacherTurmasSectionProps {
  profileName: string;
  turmas: PublicTeacherTurmaRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenTurma: (turmaId: string) => void;
}

export function PublicTeacherTurmasSection({
  profileName,
  turmas,
  isLoading,
  isError,
  onRetry,
  onOpenTurma,
}: PublicTeacherTurmasSectionProps) {
  const state = getPublicTurmasSectionState({ isLoading, isError, count: turmas.length });

  return (
    <section aria-labelledby="teacher-turmas-title" className="space-y-5">
      <div>
        <p className="text-sm font-medium text-primary">Turmas públicas</p>
        <h2 id="teacher-turmas-title" className="text-2xl font-bold">
          Turmas públicas de {profileName}
        </h2>
      </div>

      {state === 'loading' ? (
        <Card className="p-10 text-center text-muted-foreground">
          Carregando turmas públicas...
        </Card>
      ) : state === 'error' ? (
        <Card className="p-8 text-center">
          <School className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="font-semibold">Não foi possível carregar as turmas públicas</h3>
          <Button variant="outline" className="mt-5" onClick={onRetry}>
            Tentar novamente
          </Button>
        </Card>
      ) : state === 'empty' ? (
        <Card className="p-10 text-center">
          <School className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="font-semibold">Nenhuma turma pública disponível</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Este professor ainda não publicou turmas para visitantes.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {turmas.map((turma) => (
            <Card key={turma.id} className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-semibold">{turma.nome}</h3>
                  {turma.descricao && (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {turma.descricao}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0">Turma pública</Badge>
              </div>

              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4" />
                  {pluralizeCount(turma.assignment_count, 'atividade', 'atividades')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  {pluralizeCount(turma.card_count, 'card', 'cards')}
                </span>
              </div>

              <Button className="mt-6 w-full sm:w-auto" onClick={() => onOpenTurma(turma.id)}>
                Acessar turma
              </Button>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
