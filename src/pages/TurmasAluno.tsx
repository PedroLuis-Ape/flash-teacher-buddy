import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Circle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTurmasAsAluno } from '@/features/classroom/hooks/useTurmas';
import { useMyPendingTurmaMemberships, useTransitionTurmaMembership } from '@/features/classroom/hooks/useClassroomMembership';
import { useAtribuicoesMinhas } from '@/features/classroom/hooks/useAtribuicoes';
import { markPendingClassGlossaryContext } from '@/features/classroom/lib/classGlossary';

export default function TurmasAluno() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: turmasData, isLoading: turmasLoading, isError: turmasError, refetch: refetchTurmas } = useTurmasAsAluno();
  const { data: atribuicoesData, isLoading: atribuicoesLoading, isError: atribuicoesError } = useAtribuicoesMinhas();
  const pendingMemberships = useMyPendingTurmaMemberships();
  const membershipTransition = useTransitionTurmaMembership();
  const atribuicoes = useMemo(() => {
    const raw = atribuicoesData?.atribuicoes || [];
    return [...raw].sort((a: any, b: any) => {
      const orderDiff = (a.order_index ?? 0) - (b.order_index ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [atribuicoesData]);

  if (turmasLoading || atribuicoesLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (turmasError || atribuicoesError) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md space-y-4 p-6 text-center">
          <p className="text-sm text-destructive">{t('classes.loadError')}</p>
          <Button onClick={() => void refetchTurmas()}>{t('common.retry')}</Button>
        </Card>
      </div>
    );
  }

  const turmas = turmasData?.turmas || [];

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
        return <Badge className="bg-green-500">{t('classes.student.statusDone')}</Badge>;
      case 'em_andamento':
        return <Badge className="bg-yellow-500">{t('classes.student.statusInProgress')}</Badge>;
      default:
        return <Badge variant="outline">{t('classes.student.statusPending')}</Badge>;
    }
  };

  const openAssignment = (atribuicao: any) => {
    const turmaId = typeof atribuicao.turma_id === 'string' ? atribuicao.turma_id : '';
    if (turmaId) markPendingClassGlossaryContext(turmaId);

    if (atribuicao.fonte_tipo === 'lista') {
      const query = turmaId ? `?turma=${encodeURIComponent(turmaId)}` : '';
      navigate(`/list/${atribuicao.fonte_id}/games${query}`);
    } else if (atribuicao.fonte_tipo === 'pasta') {
      navigate(`/folder/${atribuicao.fonte_id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:px-8 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">{t('classes.myClasses')}</h1>
        </div>

        <div className="space-y-4">
          {(pendingMemberships.data?.length ?? 0) > 0 && (
            <Card className="space-y-3 border-primary/20 p-4">
              <div>
                <h2 className="font-semibold">{t('classes.student.requestsTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t('classes.student.requestsHint')}</p>
              </div>
              {pendingMemberships.data?.map((membership) => (
                <div key={membership.membership_id} className="flex flex-col gap-3 rounded border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{membership.nome}</p>
                    <p className="text-xs text-muted-foreground">{membership.status === 'invited' ? t('classes.student.inviteReceived') : t('classes.student.requestPending')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {membership.status === 'invited' ? (
                      <>
                        <Button
                          size="sm"
                          disabled={membershipTransition.isPending}
                          onClick={() => void membershipTransition.mutateAsync({ turmaId: membership.turma_id, action: 'accept_invite' })}
                        >
                          {t('classes.student.accept')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={membershipTransition.isPending}
                          onClick={() => void membershipTransition.mutateAsync({ turmaId: membership.turma_id, action: 'reject_invite' })}
                        >
                          {t('classes.student.reject')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={membershipTransition.isPending}
                        onClick={() => void membershipTransition.mutateAsync({ turmaId: membership.turma_id, action: 'cancel_request' })}
                      >
                        {t('classes.student.cancelRequest')}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/turmas/${membership.turma_id}`)}>{t('classes.student.open')}</Button>
                  </div>
                </div>
              ))}
            </Card>
          )}
          <h2 className="text-lg font-semibold">{t('classes.student.enrolledClasses')}</h2>
          {turmas.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">{t('classes.student.notEnrolled')}</p>
            </Card>
          ) : (
            turmas.map((turma: any) => (
              <Card
                key={turma.id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/turmas/${turma.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{turma.nome}</h3>
                    {turma.descricao && (
                      <p className="text-sm text-muted-foreground mt-1">{turma.descricao}</p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('classes.assignments')}</h2>
          {atribuicoes.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">{t('classes.noAssignments')}</p>
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
                            {t('classes.student.percentComplete', { value: atribuicao.progresso })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => openAssignment(atribuicao)}>
                    {atribuicao.status === 'concluida' ? t('classes.student.review') : t('classes.student.study')}
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
