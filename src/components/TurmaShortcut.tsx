import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronRight, Sparkles, Users } from "lucide-react";
import { useTurmasAsAluno, useTurmasMine } from "@/features/classroom/hooks/useTurmas";
import { ApeSectionTitle } from "@/components/ape/ApeSectionTitle";

interface Props {
  isTeacher: boolean;
}

export function TurmaShortcut({ isTeacher }: Props) {
  const navigate = useNavigate();
  const studentQuery = useTurmasAsAluno();
  const teacherQuery = useTurmasMine();

  const query = isTeacher ? teacherQuery : studentQuery;
  const turmas = query.data?.turmas || [];

  if (query.isLoading || turmas.length === 0) return null;

  const visibleTurmas = turmas.slice(0, 3);
  const hasMore = turmas.length > 3;
  const viewAllRoute = isTeacher ? "/turmas/professor" : "/turmas/aluno";
  const Icon = isTeacher ? Users : BookOpen;
  const title = isTeacher ? "Minhas Turmas" : "Suas Turmas";

  return (
    <section className="min-w-0 max-w-full space-y-3 overflow-hidden" aria-labelledby="home-turmas-title">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" />
          <div id="home-turmas-title" className="min-w-0">
            <ApeSectionTitle>{title}</ApeSectionTitle>
          </div>
        </div>

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(viewAllRoute)}
            className="min-h-[36px] max-w-full shrink-0 px-2 text-primary hover:text-primary sm:px-3"
          >
            <span className="truncate">Ver todas ({turmas.length})</span>
            <ChevronRight className="ml-1 h-4 w-4 shrink-0" />
          </Button>
        )}
      </div>

      <Card className="welcome-banner min-w-0 max-w-full overflow-hidden border-0">
        <CardContent className="min-w-0 space-y-3 p-3 sm:p-4">
          {visibleTurmas.map((turma: any) => (
            <button
              type="button"
              key={turma.id}
              className="grid w-full min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-primary/15 bg-background/80 p-3 text-left transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.06] active:scale-[0.99]"
              onClick={() => navigate(`/turmas/${turma.id}`)}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <Icon className="h-5 w-5 text-primary" />
              </span>

              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {turma.nome || "Turma"}
                </span>
                {turma.descricao && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {turma.descricao}
                  </span>
                )}
              </span>

              <ChevronRight className="h-4 w-4 shrink-0 text-primary/60" />
            </button>
          ))}

          {turmas.length === 1 && (
            <Button
              className="mt-1 h-auto min-h-[44px] w-full max-w-full whitespace-normal px-4 py-3 text-center leading-tight"
              onClick={() => navigate(`/turmas/${turmas[0].id}`)}
            >
              <Icon className="mr-2 h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words">
                {isTeacher ? "Gerenciar turma" : "Abrir turma"}
              </span>
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
