import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Target, Trash2, CheckCircle2, AlertCircle, Clock, Send } from 'lucide-react';
import { useClassGoals, useCreateClassGoal, useDeleteClassGoal, useSubmitClassGoalAssignment, useReviewClassGoalAssignment, useMyClassGoalAssignments } from '@/hooks/useClassGoals';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClassGoalsTabProps {
  turmaId: string;
  isOwner: boolean;
  membros: any[];
}

export function ClassGoalsTab({ turmaId, isOwner, membros }: ClassGoalsTabProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [targetType, setTargetType] = useState<'folder' | 'list'>('folder');
  const [targetId, setTargetId] = useState('');
  const [percentRequired, setPercentRequired] = useState('50');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  // Review state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewingAssignment, setReviewingAssignment] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const { data: classGoals = [], isLoading } = useClassGoals(turmaId);
  const { data: myAssignments = [] } = useMyClassGoalAssignments(turmaId);
  const createGoal = useCreateClassGoal();
  const deleteGoal = useDeleteClassGoal();
  const submitAssignment = useSubmitClassGoalAssignment();
  const reviewAssignment = useReviewClassGoalAssignment();

  // Fetch teacher's folders and lists
  const { data: turmaData } = useQuery({
    queryKey: ['turma-owner', turmaId],
    queryFn: async () => {
      const { data } = await supabase
        .from('turmas')
        .select('owner_teacher_id')
        .eq('id', turmaId)
        .single();
      return data;
    },
    enabled: !!turmaId,
  });

  const { data: sourcesData } = useQuery({
    queryKey: ['goal-sources', turmaData?.owner_teacher_id],
    queryFn: async () => {
      if (!turmaData?.owner_teacher_id) return { folders: [], lists: [] };

      const { data: folders } = await supabase
        .from('folders')
        .select('id, title')
        .eq('owner_id', turmaData.owner_teacher_id)
        .eq('visibility', 'class')
        .order('title');

      const { data: lists } = await supabase
        .from('lists')
        .select('id, title')
        .eq('owner_id', turmaData.owner_teacher_id)
        .eq('visibility', 'class')
        .order('title');

      return { folders: folders || [], lists: lists || [] };
    },
    enabled: !!turmaData?.owner_teacher_id,
  });

  const handleCreateGoal = async () => {
    if (!titulo.trim() || !targetId || selectedStudents.length === 0) {
      toast.error('Preencha todos os campos e selecione pelo menos um aluno');
      return;
    }

    await createGoal.mutateAsync({
      turma_id: turmaId,
      titulo,
      descricao,
      targets: [{
        target_type: targetType,
        target_id: targetId,
        percent_required: parseInt(percentRequired) || 50,
      }],
      aluno_ids: selectedStudents,
    });

    // Reset form
    setCreateDialogOpen(false);
    setTitulo('');
    setDescricao('');
    setTargetId('');
    setPercentRequired('50');
    setSelectedStudents([]);
  };

  const handleSubmitAssignment = async (assignmentId: string) => {
    await submitAssignment.mutateAsync({ assignment_id: assignmentId });
  };

  const handleReview = async (status: 'approved' | 'needs_revision') => {
    if (!reviewingAssignment) return;
    
    await reviewAssignment.mutateAsync({
      assignment_id: reviewingAssignment.id,
      status,
      reviewer_notes: reviewNotes,
    });

    setReviewDialogOpen(false);
    setReviewingAssignment(null);
    setReviewNotes('');
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllStudents = () => {
    const allStudentIds = membros.filter(m => m.role === 'aluno').map(m => m.user_id);
    setSelectedStudents(allStudentIds);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'assigned':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'submitted':
        return <Badge variant="outline" className="border-blue-500 text-blue-500"><Send className="h-3 w-3 mr-1" />Entregue</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'needs_revision':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Refazer</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando metas...</div>;
  }

  // Student view
  if (!isOwner) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Minhas Metas</h3>
        {myAssignments.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Nenhuma meta atribuída.</p>
          </Card>
        ) : (
          myAssignments.map((assignment: any) => (
            <Card key={assignment.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-semibold">{assignment.class_goals?.titulo}</h4>
                  {assignment.class_goals?.descricao && (
                    <p className="text-sm text-muted-foreground mt-1">{assignment.class_goals.descricao}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {statusBadge(assignment.status)}
                    {assignment.class_goals?.due_at && (
                      <span className="text-xs text-muted-foreground">
                        Prazo: {new Date(assignment.class_goals.due_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  {assignment.reviewer_notes && (
                    <p className="text-sm mt-2 p-2 bg-muted rounded">
                      <strong>Feedback:</strong> {assignment.reviewer_notes}
                    </p>
                  )}
                </div>
                {(assignment.status === 'assigned' || assignment.status === 'needs_revision') && (
                  <Button 
                    onClick={() => handleSubmitAssignment(assignment.id)}
                    disabled={submitAssignment.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Entregar
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    );
  }

  // Teacher view
  return (
    <div className="space-y-4">
      <Button className="w-full" onClick={() => setCreateDialogOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Criar Meta de Turma
      </Button>

      {classGoals.length === 0 ? (
        <Card className="p-8 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma meta criada ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Crie metas para seus alunos estudarem pastas ou listas específicas.
          </p>
        </Card>
      ) : (
        classGoals.map((goal) => (
          <Card key={goal.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h4 className="font-semibold">{goal.titulo}</h4>
                {goal.descricao && (
                  <p className="text-sm text-muted-foreground mt-1">{goal.descricao}</p>
                )}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir meta</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir "{goal.titulo}"?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteGoal.mutate({ goal_id: goal.id, turma_id: turmaId })}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Targets */}
            {goal.targets && goal.targets.length > 0 && (
              <div className="mb-3">
                {goal.targets.map((target: any) => (
                  <Badge key={target.id} variant="outline" className="mr-2">
                    {target.target_type === 'folder' ? '📁' : '📄'} {target.target_title} ({target.percent_required}%)
                  </Badge>
                ))}
              </div>
            )}

            {/* Assignments */}
            <div className="border-t pt-3 mt-3">
              <p className="text-sm font-medium mb-2">Entregas:</p>
              <div className="space-y-2">
                {goal.assignments?.map((assignment: any) => (
                  <div key={assignment.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{assignment.aluno_nome}</span>
                      {statusBadge(assignment.status)}
                    </div>
                    {assignment.status === 'submitted' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setReviewingAssignment(assignment);
                          setReviewDialogOpen(true);
                        }}
                      >
                        Revisar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Meta de Turma</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Estudar vocabulário básico"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Instruções para os alunos..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Conteúdo</Label>
                <Select value={targetType} onValueChange={(v) => setTargetType(v as 'folder' | 'list')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="folder">Pasta</SelectItem>
                    <SelectItem value="list">Lista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>% Mínimo *</Label>
                <Select value={percentRequired} onValueChange={setPercentRequired}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30%</SelectItem>
                    <SelectItem value="50">50%</SelectItem>
                    <SelectItem value="60">60%</SelectItem>
                    <SelectItem value="80">80%</SelectItem>
                    <SelectItem value="100">100%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>{targetType === 'folder' ? 'Pasta' : 'Lista'} *</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(targetType === 'folder' ? sourcesData?.folders : sourcesData?.lists)?.map((item: any) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Alunos *</Label>
                <Button type="button" variant="link" size="sm" onClick={selectAllStudents}>
                  Selecionar Todos
                </Button>
              </div>
              <ScrollArea className="h-[150px] border rounded p-2">
                {membros.filter(m => m.role === 'aluno').map((membro: any) => (
                  <div key={membro.user_id} className="flex items-center gap-2 p-2 hover:bg-muted rounded">
                    <Checkbox
                      checked={selectedStudents.includes(membro.user_id)}
                      onCheckedChange={() => toggleStudent(membro.user_id)}
                    />
                    <span>{membro.profiles?.first_name || 'Aluno'}</span>
                  </div>
                ))}
              </ScrollArea>
              {selectedStudents.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedStudents.length} aluno(s) selecionado(s)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateGoal} 
              disabled={createGoal.isPending || !titulo.trim() || !targetId || selectedStudents.length === 0}
            >
              {createGoal.isPending ? 'Criando...' : 'Criar Meta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar Entrega</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              Aluno: <strong>{reviewingAssignment?.aluno_nome}</strong>
            </p>
            <div>
              <Label>Feedback (opcional)</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Deixe um comentário para o aluno..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="destructive" 
              onClick={() => handleReview('needs_revision')}
              disabled={reviewAssignment.isPending}
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Pedir Refazer
            </Button>
            <Button 
              onClick={() => handleReview('approved')}
              disabled={reviewAssignment.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
