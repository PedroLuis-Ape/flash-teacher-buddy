import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTurmasMine, useCreateTurma, useEnrollAluno } from '@/hooks/useTurmas';
import { toast } from 'sonner';

export default function TurmasProfessor() {
  const navigate = useNavigate();
  const { data, isLoading } = useTurmasMine();
  const createTurma = useCreateTurma();
  const enrollAluno = useEnrollAluno();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string | null>(null);

  const [newTurmaNome, setNewTurmaNome] = useState('');
  const [newTurmaDesc, setNewTurmaDesc] = useState('');
  const [enrollApeId, setEnrollApeId] = useState('');

  const handleCreateTurma = async () => {
    if (!newTurmaNome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      await createTurma.mutateAsync({
        nome: newTurmaNome,
        descricao: newTurmaDesc,
      });
      toast.success('Turma criada com sucesso!');
      setCreateDialogOpen(false);
      setNewTurmaNome('');
      setNewTurmaDesc('');
    } catch (error) {
      toast.error('Erro ao criar turma');
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const turmas = data?.turmas || [];

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
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
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{turma.nome}</h3>
                    {turma.descricao && (
                      <p className="text-sm text-muted-foreground mt-1">{turma.descricao}</p>
                    )}
                    <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{turma.turma_membros?.[0]?.count || 0} alunos</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
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
                    <Button
                      size="sm"
                      onClick={() => navigate(`/turmas/${turma.id}/atribuicoes`)}
                    >
                      Ver Atribuições
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