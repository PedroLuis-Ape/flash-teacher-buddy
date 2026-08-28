import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Users, ArrowLeft, Globe2, Lock, Copy, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useTurmasMine, useCreateTurma, useEnrollAluno, useUpdateTurma } from '@/features/classroom/hooks/useTurmas';
import { PublicTurmaOrderManager } from '@/features/classroom/components/PublicTurmaOrderManager';
import {
  publicTurmaPositionLabel,
  sortPublicTurmasByOrder,
  sortTurmasForManagement,
} from '@/features/classroom/lib/publicTurmaOrder';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function TurmasProfessor() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, isError, refetch } = useTurmasMine();
  const createTurma = useCreateTurma();
  const enrollAluno = useEnrollAluno();
  const updateTurma = useUpdateTurma();

  const [createDialogOpen, setCreateDialogOpen] = useState(searchParams.get('create') === '1');
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string | null>(null);

  const [newTurmaNome, setNewTurmaNome] = useState('');
  const [newTurmaDesc, setNewTurmaDesc] = useState('');
  const [newTurmaPublic, setNewTurmaPublic] = useState(false);
  const [enrollApeId, setEnrollApeId] = useState('');

  useEffect(() => {
    if (searchParams.get('create') === '1') setCreateDialogOpen(true);
  }, [searchParams]);

  const handleCreateDialogChange = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open && searchParams.has('create')) {
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
  };

  const handleCreateTurma = async () => {
    if (!newTurmaNome.trim()) {
      toast.error(t('classes.toast.nameRequired'));
      return;
    }

    try {
      const result = await createTurma.mutateAsync({
        nome: newTurmaNome,
        descricao: newTurmaDesc,
        public: newTurmaPublic,
      });
      toast.success(t('classes.toast.created'));
      handleCreateDialogChange(false);
      setNewTurmaNome('');
      setNewTurmaDesc('');
      setNewTurmaPublic(false);

      if (result?.turma?.id) {
        navigate(`/turmas/${result.turma.id}`);
      }
    } catch (error: any) {
      toast.error(error?.message || t('classes.toast.createFailed'));
    }
  };

  const handleEnrollAluno = async () => {
    if (!selectedTurmaId || !enrollApeId.trim()) {
      toast.error(t('classes.toast.apeIdRequired'));
      return;
    }

    try {
      await enrollAluno.mutateAsync({
        turma_id: selectedTurmaId,
        ape_id: enrollApeId,
      });
      toast.success(t('classes.toast.enrolled'));
      setEnrollDialogOpen(false);
      setEnrollApeId('');
      setSelectedTurmaId(null);
    } catch (error: any) {
      toast.error(error.message || t('classes.toast.enrollFailed'));
    }
  };

  const handleTogglePublic = async (turma: any) => {
    const nextPublic = !turma.public;

    try {
      const result = await updateTurma.mutateAsync({
        turma_id: turma.id,
        public: nextPublic,
      });

      if (result?.turma?.public !== nextPublic) {
        throw new Error(t('classes.toast.visibilityMismatch'));
      }

      toast.success(nextPublic ? t('classes.toast.published') : t('classes.toast.madePrivate'));
    } catch (error: any) {
      toast.error(error?.message || t('classes.toast.visibilityFailed'));
    }
  };

  const handleCopyPublicLink = async (turmaId: string) => {
    const url = `${window.location.origin}/turmas/${turmaId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('classes.toast.linkCopied'));
    } catch {
      toast.error(t('classes.toast.linkCopyFailed'));
    }
  };

  const rawTurmas = useMemo(
    () => Array.isArray(data?.turmas) ? data.turmas : [],
    [data?.turmas],
  );
  const turmas = useMemo(() => sortTurmasForManagement(rawTurmas), [rawTurmas]);
  const publicPositionById = useMemo(() => {
    const ordered = sortPublicTurmasByOrder(
      rawTurmas.filter((turma: any) => turma.public === true && turma.ativo !== false),
    );
    return new Map(ordered.map((turma: any, index: number) => [turma.id, index]));
  }, [rawTurmas]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md space-y-4 p-6 text-center">
          <p className="text-sm text-destructive">{t('classes.loadError')}</p>
          <Button onClick={() => void refetch()}>{t('common.retry')}</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-3 pb-24 pt-4 sm:p-4 sm:pb-24 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{t('classes.myClasses')}</h1>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              {t('classes.createdCount', { count: turmas.length })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:justify-end">
          <PublicTurmaOrderManager turmas={rawTurmas} />

          <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogChange}>
            <DialogTrigger asChild>
              <Button className="h-11 w-full rounded-xl sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                {t('classes.createNew')}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-1rem)] max-w-lg rounded-2xl sm:w-full">
              <DialogHeader>
                <DialogTitle>{t('classes.teacher.createDialogTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="nome">{t('classes.teacher.nameLabel')}</Label>
                  <Input
                    id="nome"
                    value={newTurmaNome}
                    onChange={(e) => setNewTurmaNome(e.target.value)}
                    placeholder={t('classes.teacher.namePlaceholder')}
                    maxLength={120}
                  />
                </div>
                <div>
                  <Label htmlFor="descricao">{t('classes.teacher.descriptionLabel')}</Label>
                  <Textarea
                    id="descricao"
                    value={newTurmaDesc}
                    onChange={(e) => setNewTurmaDesc(e.target.value)}
                    placeholder={t('classes.teacher.descriptionPlaceholder')}
                    maxLength={1000}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor="turma-publica" className="flex items-center gap-2">
                      <Globe2 className="h-4 w-4 text-primary" />
                      {t('classes.teacher.publicLabel')}
                    </Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t('classes.teacher.publicHint')}
                    </p>
                  </div>
                  <Switch
                    id="turma-publica"
                    checked={newTurmaPublic}
                    onCheckedChange={setNewTurmaPublic}
                    aria-label={t('classes.teacher.publicSwitchAria')}
                    className="shrink-0"
                  />
                </div>
                <Button onClick={handleCreateTurma} disabled={createTurma.isPending} className="min-h-[48px] w-full">
                  {createTurma.isPending ? t('classes.teacher.creating') : t('classes.teacher.create')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-lg rounded-2xl sm:w-full">
            <DialogHeader>
              <DialogTitle>{t('classes.teacher.enrollTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="ape_id">{t('classes.teacher.apeIdLabel')}</Label>
                <Input
                  id="ape_id"
                  value={enrollApeId}
                  onChange={(e) => setEnrollApeId(e.target.value)}
                  placeholder={t('classes.teacher.apeIdPlaceholder')}
                />
              </div>
              <Button onClick={handleEnrollAluno} disabled={enrollAluno.isPending} className="w-full">
                {enrollAluno.isPending ? t('classes.teacher.enrolling') : t('classes.teacher.enroll')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="space-y-3 sm:space-y-4">
          {turmas.length === 0 ? (
            <Card className="p-6 text-center sm:p-8">
              <Users className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-4 font-semibold">{t('classes.noneCreated')}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t('classes.teacher.emptyHint')}</p>
              <Button className="mt-5 w-full sm:w-auto" onClick={() => handleCreateDialogChange(true)}>
                <Plus className="mr-2 h-4 w-4" />{t('classes.teacher.createFirst')}
              </Button>
            </Card>
          ) : (
            turmas.map((turma: any) => {
              const publicPosition = publicPositionById.get(turma.id);
              return (
                <Card key={turma.id} className="p-4 sm:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="min-w-0 break-words text-base font-semibold sm:text-lg">{turma.nome}</h3>
                        <Badge variant={turma.public ? 'default' : 'secondary'} className="shrink-0">
                          {turma.public ? <Globe2 className="mr-1 h-3 w-3" /> : <Lock className="mr-1 h-3 w-3" />}
                          {turma.public ? t('classes.teacher.badgePublic') : t('classes.teacher.badgePrivate')}
                        </Badge>
                        {turma.public && publicPosition !== undefined && (
                          <Badge variant="outline" className="shrink-0 font-mono text-primary">
                            {publicTurmaPositionLabel(publicPosition)}
                          </Badge>
                        )}
                      </div>
                      {turma.descricao && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{turma.descricao}</p>
                      )}
                      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{t('classes.studentsCount', { count: turma.turma_membros?.[0]?.count || 0 })}</span>
                      </div>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={updateTurma.isPending}
                        onClick={() => handleTogglePublic(turma)}
                      >
                        {turma.public ? <Lock className="mr-1 h-4 w-4" /> : <Globe2 className="mr-1 h-4 w-4" />}
                        {turma.public ? t('classes.teacher.makePrivate') : t('classes.teacher.makePublic')}
                      </Button>

                      {turma.public && (
                        <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => handleCopyPublicLink(turma.id)}>
                          <Copy className="mr-1 h-4 w-4" />
                          {t('classes.teacher.copyLink')}
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => navigate(`/turmas/${turma.id}?tab=trafego`)}
                      >
                        <BarChart3 className="mr-1 h-4 w-4" />
                        {t('classes.teacher.traffic')}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setSelectedTurmaId(turma.id);
                          setEnrollDialogOpen(true);
                        }}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        {t('classes.teacher.student')}
                      </Button>

                      <Button size="sm" className="col-span-2 w-full sm:w-auto" onClick={() => navigate(`/turmas/${turma.id}`)}>
                        {t('classes.teacher.manage')}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
