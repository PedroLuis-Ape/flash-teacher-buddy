import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronRight, Plus, Sparkles, Users } from "lucide-react";
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

  if (query.isLoading) return null;
  if (!isTeacher && turmas.length === 0) return null;

  const visibleTurmas = turmas.slice(0, 3);
  const managementRoute = isTeacher ? "/turmas/professor" : "/turmas";
  const createRoute = "/turmas/professor?create=1";
  const Icon = isTeacher ? Users : BookOpen;
  const title = isTeacher ? "Minhas Turmas" : "Suas Turmas";

  return (
    <section className="home-turma-shortcut w-full min-w-0 space-y-3" aria-label={title}>
      <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 truncate">
            <ApeSectionTitle>{title}</ApeSectionTitle>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isTeacher && (
            <Button
              size="sm"
              onClick={() => navigate(createRoute)}
              className="min-h-[36px] shrink-0 px-3"
            >
              <Plus className="mr-1 h-4 w-4" />
              Nova turma
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(managementRoute)}
            className="min-h-[36px] shrink-0 px-3 text-primary hover:text-primary"
          >
            {isTeacher ? `Gerenciar (${turmas.length})` : `Ver todas (${turmas.length})`}
            <ChevronRight className="ml-1 h-4 w-4 shrink-0" />
          </Button>
        </div>
      </div>

      <Card className="card-premium w-full min-w-0 overflow-hidden">
        <CardContent className="w-full min-w-0 space-y-3 p-4">
          {turmas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] p-5 text-center">
              <Users className="mx-auto h-8 w-8 text-primary" />
              <h3 className="mt-3 font-semibold">Crie sua primeira turma</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Você pode manter várias turmas separadas, com alunos, atividades e conteúdos próprios.
              </p>
              <Button className="mt-4 min-h-[44px] w-full" onClick={() => navigate(createRoute)}>
                <Plus className="mr-2 h-4 w-4" />Criar turma
              </Button>
            </div>
          ) : (
            visibleTurmas.map((turma: any) => (
              <button
                type="button"
                key={turma.id}
                className="flex w-full min-w-0 items-center gap-4 rounded-xl border border-primary/15 bg-background/80 p-3 text-left transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.06] active:scale-[0.98]"
                onClick={() => navigate(`/turmas/${turma.id}`)}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <Icon className="h-5 w-5 text-primary" />
                </span>
                <span className="min-w-0 flex-1">
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
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
