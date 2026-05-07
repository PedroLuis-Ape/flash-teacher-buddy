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
  const turmas = (isTeacher ? query.data?.turmas : query.data?.turmas) || [];

  // Don't render anything if loading or no turmas
  if (query.isLoading || turmas.length === 0) return null;

  const visibleTurmas = turmas.slice(0, 3);
  const hasMore = turmas.length > 3;
  const viewAllRoute = isTeacher ? "/turmas-professor" : "/turmas";
  const Icon = isTeacher ? Users : BookOpen;
  const title = isTeacher ? "Minhas Turmas" : "Suas Turmas";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <ApeSectionTitle>{title}</ApeSectionTitle>
        </div>
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(viewAllRoute)}
            className="min-h-[36px] px-3 text-primary hover:text-primary"
          >
            Ver todas ({turmas.length})
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      <Card className="welcome-banner border-0 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          {visibleTurmas.map((turma: any) => (
            <div
              key={turma.id}
              className="flex items-center gap-4 p-3 rounded-xl bg-background/80 border border-primary/15 cursor-pointer hover:bg-primary/[0.06] hover:border-primary/30 transition-all duration-200 active:scale-[0.98]"
              onClick={() => navigate(`/turmas/${turma.id}`)}
            >
              <div className="shrink-0 w-11 h-11 rounded-lg bg-primary/15 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm truncate">
                  {turma.nome || "Turma"}
                </h4>
                {turma.descricao && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {turma.descricao}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-primary/60 shrink-0" />
            </div>
          ))}

          {turmas.length === 1 && (
            <Button
              className="w-full mt-1 min-h-[44px]"
              onClick={() => navigate(`/turmas/${turmas[0].id}`)}
            >
              <Icon className="h-4 w-4 mr-2" />
              {isTeacher ? "Gerenciar turma" : "Abrir turma"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
