import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserPlus, FileText, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useStudentsList, useAddStudentsToClass, useAssignToStudents } from '@/hooks/useMeusAlunos';
import { useTurmasMine } from '@/hooks/useTurmas';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function MeusAlunos() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [showAddToClassDialog, setShowAddToClassDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedTurmaId, setSelectedTurmaId] = useState('');
  const [authReady, setAuthReady] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth', { replace: true });
        return;
      }
      setAuthReady(true);
    };
    checkAuth();
  }, [navigate]);

  const { data: studentsData, isLoading } = useStudentsList(authReady ? searchQuery : undefined);
  const { data: turmasData } = useTurmasMine();
  const addToClass = useAddStudentsToClass();
  const assignToStudents = useAssignToStudents();

  const students = studentsData?.students || [];
  const turmas = turmasData?.turmas || [];

  const toggleStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const selectAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map((s: any) => s.aluno_id)));
    }
  };

  const handleAddToClass = async () => {
    if (selectedStudents.size === 0) {
      toast.error('Selecione ao menos 1 aluno.');
      return;
    }
    if (!selectedTurmaId) {
      toast.error('Selecione uma turma.');
      return;
    }

    try {
      await addToClass.mutateAsync({
        turma_id: selectedTurmaId,
        student_ids: Array.from(selectedStudents),
      });
      toast.success('Alunos adicionados à turma.');
      setShowAddToClassDialog(false);
      setSelectedStudents(new Set());
      setSelectedTurmaId('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao adicionar alunos');
    }
  };

  const handleOpenDM = async (alunoId: string) => {
    // Find a common turma to open DM
    const commonTurma = turmas[0]; // Use first turma for simplicity
    if (!commonTurma) {
      toast.error('Crie uma turma primeiro para enviar mensagens');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase.functions.invoke('classes-dm-open', {
        body: { turma_id: commonTurma.id, aluno_id: alunoId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (data?.dm_pair_id) {
        navigate(`/turmas/${commonTurma.id}?tab=chat&dm=${data.dm_pair_id}`);
      }
    } catch (error: any) {
      toast.error('Erro ao abrir conversa');
    }
  };

  if (!authReady || isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Meus Alunos</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Search and Actions */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou APE ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {selectedStudents.size > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedStudents.size} aluno(s) selecionado(s)
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddToClassDialog(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar à Turma
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAssignDialog(true)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Atribuir Atividade
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Students List */}
        {students.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Nenhum aluno encontrado.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                checked={selectedStudents.size === students.length && students.length > 0}
                onCheckedChange={selectAll}
              />
              <span className="text-sm text-muted-foreground">Selecionar todos</span>
            </div>

            {students.map((student: any) => (
              <Card key={student.aluno_id} className="p-4">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedStudents.has(student.aluno_id)}
                    onCheckedChange={() => toggleStudent(student.aluno_id)}
                  />

                  <Avatar className="h-10 w-10">
                    <AvatarImage src={student.avatar_url} />
                    <AvatarFallback>{student.nome[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <h3 className="font-semibold">{student.nome}</h3>
                    <p className="text-sm text-muted-foreground">{student.ape_id}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/professor/alunos/${student.aluno_id}`)}
                    >
                      Ver Perfil
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenDM(student.aluno_id)}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add to Class Dialog */}
      <Dialog open={showAddToClassDialog} onOpenChange={setShowAddToClassDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar à Turma</DialogTitle>
            <DialogDescription>
              Selecione a turma para adicionar {selectedStudents.size} aluno(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Turma</Label>
              <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma turma" />
                </SelectTrigger>
                <SelectContent>
                  {turmas.map((turma: any) => (
                    <SelectItem key={turma.id} value={turma.id}>
                      {turma.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddToClassDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddToClass} disabled={addToClass.isPending}>
                {addToClass.isPending ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Activity Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Atividade</DialogTitle>
            <DialogDescription>
              Esta funcionalidade será implementada em breve.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowAssignDialog(false)}>Fechar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
