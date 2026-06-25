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

export default function TurmasProfessor() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading } = useTurmasMine();
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
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      const result = await createTurma.mutateAsync({
        nome: newTurmaNome,
        descricao: newTurmaDesc,
        public: newTurmaPublic,
      });
      toast.success('Turma criada com sucesso!');
      handleCreateDialogChange(false);
      setNewTurmaNome('');
      setNewTurmaDesc('');
      setNewTurmaPublic(false);

      if (result?.turma?.id) {
        navigate(`/turmas/${result.turma.id}`);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao criar turma');
    }
  };

  const handleEnrollAluno = async () => {
    if (!selectedTurmaId || !enrollApeId.trim()) {
      toast.error('APE ID é obrigatório');
      return;
    }

    try {
      await enrollAluno.mutateAsync({
        turma_id: selectedTurmaId,
        ape_id: enrollApeId,
      });
      toast.success('Aluno matriculado com sucesso!');
      setEnrollDialogOpen(false);
      setEnrollApeId('');
      setSelectedTurmaId(null);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao matricular aluno');
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
        throw new Error('A visibilidade retornada pelo banco não corresponde à alteração solicitada.');
      }

      toast.success(nextPublic ? 'Turma publicada com sucesso!' : 'Turma agora é privada.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível alterar a visibilidade da turma.');
    }
  };

  const handleCopyPublicLink = async (turmaId: string) => {
    const url = `${window.location.origin}/turmas/${turmaId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link público copiado!');
    } catch {
      toast.error('Não foi possível copiar o link.');
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
        <p className="text-muted-foreground">Carregando...</p>
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
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Minhas Turmas</h1>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              {turmas.length} {turmas.length === 1 ? 'turma criada' : 'turmas criadas'}. Você pode criar quantas turmas precisar.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:justify-end">
          <PublicTurmaOrderManager turmas={rawTurmas} />

          <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogChange}>
            <DialogTrigger asChild>
              <Button className="h-11 w-full rounded-xl sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Criar Nova Turma
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-1rem)] max-w-lg rounded-2xl sm:w-full">
              <DialogHeader>
                <DialogTitle>Criar uma nova turma</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="nome">Nome da Turma</Label>
                  <Input
                    id="nome"
                    value={newTurmaNome}
                    onChange={(e) => setNewTurmaNome(e.target.value)}
                    placeholder="Ex: Inglês Básico"
                    maxLength={120}
                  />
                </div>
                <div>
                  <Label htmlFor="descricao">Descrição (opcional)</Label>
                  <Textarea
                    id="descricao"
                    value={newTurmaDesc}
                    onChange={(e) => setNewTurmaDesc(e.target.value)}
                    placeholder="Descrição da turma..."
                    maxLength={1000}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor="turma-publica" className="flex items-center gap-2">
                      <Globe2 className="h-4 w-4 text-primary" />
                      Turma pública
                    </Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Qualquer pessoa com o link poderá ver as atividades em modo somente leitura.
                    </p>
                  </div>
                  <Switch
                    id="turma-publica"
                    checked={newTurmaPublic}
                    onCheckedChange={setNewTurmaPublic}
                    aria-label="Permitir acesso público à turma"
                    className="shrink-0"
                  />
                </div>
                <Button onClick={handleCreateTurma} disabled={createTurma.isPending} className="min-h-[48px] w-full">
                  {createTurma.isPending ? 'Criando...' : 'Criar Turma'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-lg rounded-2xl sm:w-full">
            <DialogHeader>
              <DialogTitle>Matricular Aluno</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="ape_id">APE ID do Aluno</Label>
                <Input
                  id="ape_id"
                  value={enrollApeId}
                  onChange={(e) => setEnrollApeId(e.target.value)}
                  placeholder="Ex: ABC12345"
                />
              </div>
              <Button onClick={handleEnrollAluno} disabled={enrollAluno.isPending} className="w-full">
                {enrollAluno.isPending ? 'Matriculando...' : 'Matricular'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="space-y-3 sm:space-y-4">
          {turmas.length === 0 ? (
            <Card className="p-6 text-center sm:p-8">
              <Users className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-4 font-semibold">Nenhuma turma criada ainda.</p>
              <p className="mt-2 text-sm text-muted-foreground">Crie sua primeira turma para organizar alunos e conteúdos separadamente.</p>
              <Button className="mt-5 w-full sm:w-auto" onClick={() => handleCreateDialogChange(true)}>
                <Plus className="mr-2 h-4 w-4" />Criar primeira turma
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
                          {turma.public ? 'Pública' : 'Privada'}
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
                        <span>{turma.turma_membros?.[0]?.count || 0} alunos</span>
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
                        {turma.public ? 'Privar' : 'Publicar'}
                      </Button>

                      {turma.public && (
                        <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => handleCopyPublicLink(turma.id)}>
                          <Copy className="mr-1 h-4 w-4" />
                          Copiar link
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => navigate(`/turmas/${turma.id}?tab=trafego`)}
                      >
                        <BarChart3 className="mr-1 h-4 w-4" />
                        Tráfego
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
                        Aluno
                      </Button>

                      <Button size="sm" className="col-span-2 w-full sm:w-auto" onClick={() => navigate(`/turmas/${turma.id}`)}>
                        Gerenciar
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
