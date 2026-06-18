import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, ArrowLeft, Globe2, Lock, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useTurmasMine, useCreateTurma, useEnrollAluno, useUpdateTurma } from '@/features/classroom/hooks/useTurmas';
import { toast } from 'sonner';

export default function TurmasProfessor() {
  const navigate = useNavigate();
  const { data, isLoading } = useTurmasMine();
  const createTurma = useCreateTurma();
  const enrollAluno = useEnrollAluno();
  const updateTurma = useUpdateTurma();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string | null>(null);

  const [newTurmaNome, setNewTurmaNome] = useState('');
  const [newTurmaDesc, setNewTurmaDesc] = useState('');
  const [newTurmaPublic, setNewTurmaPublic] = useState(false);
  const [enrollApeId, setEnrollApeId] = useState('');

  const handleCreateTurma = async () => {
    if (!newTurmaNome.trim()) {
      toast.error('❌ Nome é obrigatório');
      return;
    }

    try {
      const result = await createTurma.mutateAsync({
        nome: newTurmaNome,
        descricao: newTurmaDesc,
        public: newTurmaPublic,
      });
      toast.success('✅ Turma criada com sucesso!');
      setCreateDialogOpen(false);
      setNewTurmaNome('');
      setNewTurmaDesc('');
      setNewTurmaPublic(false);

      if (result?.turma?.id) {
        navigate(`/turmas/${result.turma.id}`);
      }
    } catch (error) {
      toast.error('❌ Erro ao criar turma');
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const turmas = data?.turmas || [];

  return (
    <div className="min-h-screen bg-background p-4 lg:px-8 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Minhas Turmas</h1>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Criar Nova Turma
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Turma</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome da Turma</Label>
                <Input
                  id="nome"
                  value={newTurmaNome}
                  onChange={(e) => setNewTurmaNome(e.target.value)}
                  placeholder="Ex: Inglês Básico"
                />
              </div>
              <div>
                <Label htmlFor="descricao">Descrição (opcional)</Label>
                <Textarea
                  id="descricao"
                  value={newTurmaDesc}
                  onChange={(e) => setNewTurmaDesc(e.target.value)}
                  placeholder="Descrição da turma..."
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                <div className="space-y-1">
                  <Label htmlFor="turma-publica" className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-primary" />
                    Turma pública
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Qualquer pessoa com o link poderá ver as atividades em modo somente leitura.
                  </p>
                </div>
                <Switch
                  id="turma-publica"
                  checked={newTurmaPublic}
                  onCheckedChange={setNewTurmaPublic}
                  aria-label="Permitir acesso público à turma"
                />
              </div>
              <Button onClick={handleCreateTurma} disabled={createTurma.isPending} className="w-full">
                {createTurma.isPending ? 'Criando...' : 'Criar Turma'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
          <DialogContent>
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

        <div className="space-y-4">
          {turmas.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Nenhuma turma criada ainda.</p>
              <p className="text-sm text-muted-foreground mt-2">Clique em "Criar Nova Turma" para começar.</p>
            </Card>
          ) : (
            turmas.map((turma: any) => (
              <Card key={turma.id} className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{turma.nome}</h3>
                      <Badge variant={turma.public ? 'default' : 'secondary'}>
                        {turma.public ? <Globe2 className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                        {turma.public ? 'Pública' : 'Privada'}
                      </Badge>
                    </div>
                    {turma.descricao && (
                      <p className="text-sm text-muted-foreground mt-1">{turma.descricao}</p>
                    )}
                    <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{turma.turma_membros?.[0]?.count || 0} alunos</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateTurma.isPending}
                      onClick={() => handleTogglePublic(turma)}
                    >
                      {turma.public ? <Lock className="h-4 w-4 mr-1" /> : <Globe2 className="h-4 w-4 mr-1" />}
                      {turma.public ? 'Tornar privada' : 'Publicar'}
                    </Button>
                    {turma.public && (
                      <Button size="sm" variant="outline" onClick={() => handleCopyPublicLink(turma.id)}>
                        <Copy className="h-4 w-4 mr-1" />
                        Copiar link
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedTurmaId(turma.id);
                        setEnrollDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Aluno
                    </Button>
                    <Button size="sm" onClick={() => navigate(`/turmas/${turma.id}`)}>
                      Gerenciar
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
