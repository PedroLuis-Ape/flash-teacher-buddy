import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronRight, Plus, Sparkles, Users } from "lucide-react";
import { useTurmasAsAluno, useTurmasMine } from "@/features/classroom/hooks/useTurmas";
import { ApeSectionTitle } from "@/components/ape/ApeSectionTitle";
import { cn } from "@/lib/utils";

interface Props {
  isTeacher: boolean;
}

export function TurmaShortcut({ isTeacher }: Props) {
  const navigate = useNavigate();
  const studentQuery = useTurmasAsAluno();
  const teacherQuery = useTurmasMine();

  const query = isTeacher ? teacherQuery : studentQuery;
  const turmas = query.data?.turmas || [];

  if (query.isLoading) return null;
  if (!isTeacher && turmas.length === 0) return null;

  const visibleTurmas = turmas.slice(0, 4);
  const managementRoute = isTeacher ? "/turmas/professor" : "/turmas";
  const createRoute = "/turmas/professor?create=1";
  const Icon = isTeacher ? Users : BookOpen;
  const title = isTeacher ? "Minhas Turmas" : "Suas Turmas";

  return (
    <section className="home-turma-shortcut w-full min-w-0 space-y-2.5" aria-label={title}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" />
          <div className="min-w-0 truncate">
            <ApeSectionTitle>{title}</ApeSectionTitle>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {isTeacher && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(createRoute)}
              className="h-8 rounded-lg px-2 text-xs sm:h-9 sm:px-3"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              <span className="sm:hidden">Nova</span>
              <span className="hidden sm:inline">Nova turma</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(managementRoute)}
            className="h-8 rounded-lg px-2 text-xs text-primary hover:text-primary sm:h-9 sm:px-3"
          >
            <span className="sm:hidden">Ver todas</span>
            <span className="hidden sm:inline">
              {isTeacher ? `Gerenciar (${turmas.length})` : `Ver todas (${turmas.length})`}
            </span>
            <ChevronRight className="ml-0.5 h-3.5 w-3.5 shrink-0 sm:ml-1 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>

      {turmas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.04] p-3 text-center sm:p-5">
          <Users className="mx-auto h-6 w-6 text-primary sm:h-8 sm:w-8" />
          <h3 className="mt-2 text-sm font-semibold sm:mt-3 sm:text-base">Crie sua primeira turma</h3>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Separe alunos, atividades e conteúdos em espaços próprios.
          </p>
          <Button className="mt-3 h-9 w-full rounded-xl text-sm sm:mt-4 sm:min-h-[44px]" onClick={() => navigate(createRoute)}>
            <Plus className="mr-2 h-4 w-4" />Criar turma
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          {visibleTurmas.map((turma: any) => (
            <button
              type="button"
              key={turma.id}
              className={cn(
                "group flex min-h-[4.4rem] min-w-0 items-center gap-2 rounded-xl border border-primary/15 bg-card px-2.5 py-2 text-left shadow-sm",
                "transition-all duration-200 hover:border-primary/35 hover:bg-primary/[0.05] hover:shadow-md active:scale-[0.98]",
                "sm:min-h-[5rem] sm:gap-3 sm:rounded-2xl sm:px-3 sm:py-3",
              )}
              onClick={() => navigate(`/turmas/${turma.id}`)}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 sm:h-10 sm:w-10 sm:rounded-xl">
                <Icon className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold leading-tight sm:text-sm">
                  {turma.nome || "Turma"}
                </span>
                {turma.descricao && (
                  <span className="mt-1 hidden truncate text-xs text-muted-foreground sm:block">
                    {turma.descricao}
                  </span>
                )}
              </span>

              <ChevronRight className="hidden h-4 w-4 shrink-0 text-primary/55 sm:block" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
