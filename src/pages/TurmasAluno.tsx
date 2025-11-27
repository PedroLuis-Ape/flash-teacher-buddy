import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, Circle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTurmasAsAluno } from '@/hooks/useTurmas';
import { useAtribuicoesMinhas } from '@/hooks/useAtribuicoes';

export default function TurmasAluno() {
  const navigate = useNavigate();
  const { data: turmasData, isLoading: turmasLoading } = useTurmasAsAluno();
  const { data: atribuicoesData, isLoading: atribuicoesLoading } = useAtribuicoesMinhas();

  if (turmasLoading || atribuicoesLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const turmas = turmasData?.turmas || [];
  const atribuicoes = atribuicoesData?.atribuicoes || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concluida':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'em_andamento':
        return <Clock className="h-5 w-5 text-warning" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'concluida':
        return <Badge className="bg-green-500">Concluída</Badge>;
      case 'em_andamento':
        return <Badge className="bg-yellow-500">Em Andamento</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Minhas Turmas</h1>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Turmas Matriculadas</h2>
          {turmas.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Você não está matriculado em nenhuma turma ainda.</p>
            </Card>
          ) : (
            turmas.map((turma: any) => (
              <Card key={turma.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{turma.nome}</h3>
                    {turma.descricao && (
                      <p className="text-sm text-muted-foreground mt-1">{turma.descricao}</p>
                    )}
                  </div>
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Atribuições</h2>
          {atribuicoes.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Nenhuma atribuição ainda.</p>
            </Card>
          ) : (
            atribuicoes.map((atribuicao: any) => (
              <Card key={atribuicao.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(atribuicao.status)}
                    <div className="flex-1">
                      <h3 className="font-semibold">{atribuicao.titulo}</h3>
                      {atribuicao.descricao && (
                        <p className="text-sm text-muted-foreground mt-1">{atribuicao.descricao}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {getStatusBadge(atribuicao.status)}
                        <span className="text-sm text-muted-foreground">
                          {atribuicao.pontos_vale} pontos
                        </span>
                      </div>
                      {atribuicao.progresso > 0 && (
                        <div className="mt-2">
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${atribuicao.progresso}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {atribuicao.progresso}% completo
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {atribuicao.status !== 'concluida' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        // Navigate to the source content
                        if (atribuicao.fonte_tipo === 'lista') {
                          navigate(`/list/${atribuicao.fonte_id}`);
                        } else if (atribuicao.fonte_tipo === 'pasta') {
                          navigate(`/folder/${atribuicao.fonte_id}`);
                        }
                      }}
                    >
                      Abrir
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}