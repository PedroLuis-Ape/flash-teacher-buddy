import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useStudentOverview } from '@/hooks/useMeusAlunos';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ErrorMessage } from '@/components/ErrorMessage';

export default function AlunoProfile() {
  const { alunoId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useStudentOverview(alunoId || null);

  if (isLoading) {
    return <LoadingSpinner message="Carregando perfil do aluno..." />;
  }

  if (error) {
    return (
      <ErrorMessage
        title="Erro ao carregar aluno"
        message="Não foi possível carregar o perfil deste aluno."
        onRetry={() => refetch()}
        onGoBack={() => navigate('/professor/alunos')}
      />
    );
  }

  if (!data || !data.student) {
    return (
      <ErrorMessage
        title="Aluno não encontrado"
        message="Este aluno não existe ou não está disponível."
        onGoBack={() => navigate('/professor/alunos')}
      />
    );
  }

  const { student, assignments, commonTurmas, lastDmMessage } = data;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="max-w-6xl mx-auto p-4 lg:px-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/professor/alunos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Perfil do Aluno</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 lg:px-8 space-y-4">
        {/* Student Header */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={student.avatar_url} />
              <AvatarFallback>{student.first_name?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{student.first_name}</h2>
              <p className="text-muted-foreground">{student.ape_id}</p>
              <div className="flex gap-4 mt-2">
                <Badge variant="outline">Nível {student.level}</Badge>
                <Badge variant="outline">{student.xp_total} XP</Badge>
                <Badge variant="outline">{student.pts_weekly} PTS</Badge>
                <Badge variant="outline">₱{student.balance_pitecoin}</Badge>
              </div>
            </div>
            <Button onClick={() => {}}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Abrir DM
            </Button>
          </div>
        </Card>

        {/* Turmas em Comum */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Turmas em Comum</h3>
          {commonTurmas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma turma em comum.</p>
          ) : (
            <div className="space-y-2">
              {commonTurmas.map((turma: any) => (
                <div
                  key={turma.id}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-accent"
                  onClick={() => navigate(`/turmas/${turma.id}`)}
                >
                  <p className="font-medium">{turma.nome}</p>
                  {turma.descricao && (
                    <p className="text-sm text-muted-foreground">{turma.descricao}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Atribuições Recentes */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Atribuições Recentes</h3>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem progresso recente.</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((assignment: any) => (
                <div
                  key={assignment.id}
                  className="p-3 border rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{assignment.atribuicao?.titulo}</p>
                      <p className="text-sm text-muted-foreground">
                        {assignment.atribuicao?.turma?.nome || 'Atribuição Direta'}
                      </p>
                    </div>
                    <Badge variant={
                      assignment.status === 'concluida' ? 'default' :
                      assignment.status === 'em_andamento' ? 'secondary' :
                      'outline'
                    }>
                      {assignment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Last DM */}
        {lastDmMessage && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Última Mensagem</h3>
            <div className="p-3 bg-accent rounded-lg">
              <p className="text-sm">{lastDmMessage.texto}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(lastDmMessage.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
