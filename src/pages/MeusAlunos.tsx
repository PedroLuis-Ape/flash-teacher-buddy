import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserPlus, FileText, MessageCircle, Loader2 } from 'lucide-react';
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
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isOnline, formatLastSeen } from '@/lib/activityStatus';
import { cn } from '@/lib/utils';

export default function MeusAlunos() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [showAddToClassDialog, setShowAddToClassDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedTurmaId, setSelectedTurmaId] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [localStudents, setLocalStudents] = useState<any[]>([]);

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

  const students = localStudents.length > 0 ? localStudents : (studentsData?.students || []);
  const turmas = turmasData?.turmas || [];

  // Sync local state with fetched data
  useEffect(() => {
    if (studentsData?.students) {
      setLocalStudents(studentsData.students);
    }
  }, [studentsData]);

  // Realtime subscription for online status updates
  useEffect(() => {
    if (!authReady || students.length === 0) return;

    const studentIds = students.map((s: any) => s.aluno_id);

    const channel = supabase
      .channel('online-status-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          const updatedId = payload.new?.id;
          if (updatedId && studentIds.includes(updatedId)) {
            setLocalStudents((prev) =>
              prev.map((s) =>
                s.aluno_id === updatedId
                  ? { ...s, last_active_at: payload.new.last_active_at }
                  : s
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authReady, students.length]);


  if (!authReady || isLoading) {
    return <LoadingSpinner message="Carregando alunos..." />;
  }

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
      toast.success('✅ Alunos adicionados à turma.');
      setShowAddToClassDialog(false);
      setSelectedStudents(new Set());
      setSelectedTurmaId('');
    } catch (error: any) {
      toast.error(error.message || '❌ Erro ao adicionar alunos');
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

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b shadow-sm">
        <div className="max-w-6xl mx-auto p-4 lg:px-8 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold truncate">Meus Alunos</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 lg:px-8 space-y-4">
        {/* Search and Actions */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por nome ou APE ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 min-h-[44px]"
            />
          </div>
        </div>

        {selectedStudents.size > 0 && (
          <Card className="p-4 border-border">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedStudents.size} aluno(s) selecionado(s)
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddToClassDialog(true)}
                  className="min-h-[40px]"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar à Turma
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAssignDialog(true)}
                  className="min-h-[40px]"
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
          <Card className="p-8 text-center border-border">
            <p className="text-muted-foreground">Nenhum aluno encontrado.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Checkbox
                checked={selectedStudents.size === students.length && students.length > 0}
                onCheckedChange={selectAll}
              />
              <span className="text-sm text-muted-foreground">Selecionar todos</span>
            </div>

            {students.map((student: any) => (
              <Card key={student.aluno_id} className="p-4 border-border hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedStudents.has(student.aluno_id)}
                    onCheckedChange={() => toggleStudent(student.aluno_id)}
                    className="shrink-0"
                  />

                  <div className="relative shrink-0">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={student.avatar_url} />
                      <AvatarFallback className="text-base">{student.nome[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {/* Online status indicator */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
                            isOnline(student.last_active_at)
                              ? "bg-green-500"
                              : "bg-gray-400"
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {isOnline(student.last_active_at)
                          ? "Online agora"
                          : `Visto ${formatLastSeen(student.last_active_at)}`}
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{student.nome}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground truncate">{student.ape_id}</span>
                      <span className="text-xs text-muted-foreground/60">
                        • {formatLastSeen(student.last_active_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{student.nome}</h3>
                    <p className="text-sm text-muted-foreground truncate">{student.ape_id}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/professor/alunos/${student.aluno_id}`)}
                      className="min-h-[36px]"
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
                {addToClass.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  'Adicionar'
                )}
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
