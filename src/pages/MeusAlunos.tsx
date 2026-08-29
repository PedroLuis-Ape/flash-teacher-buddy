import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserPlus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useStudentsList, useAddStudentsToClass } from '@/features/classroom/hooks/useMeusAlunos';
import { useTurmasMine } from '@/features/classroom/hooks/useTurmas';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useTranslation } from 'react-i18next';

export default function MeusAlunos() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [showAddToClassDialog, setShowAddToClassDialog] = useState(false);
  const [selectedTurmaId, setSelectedTurmaId] = useState('');
  const [searchTurmaId, setSearchTurmaId] = useState('');
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

  const { data: studentsData, isLoading } = useStudentsList(
    authReady ? searchQuery : undefined,
    searchTurmaId || undefined,
  );
  const { data: turmasData } = useTurmasMine();
  const addToClass = useAddStudentsToClass();

  const students = studentsData?.students || [];
  const turmas = turmasData?.turmas || [];


  if (!authReady || isLoading) {
    return <LoadingSpinner message={t('classes.students.loading')} />;
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
      toast.error(t('classes.toast.selectAtLeastOne'));
      return;
    }
    if (!selectedTurmaId) {
      toast.error(t('classes.toast.selectClass'));
      return;
    }

    try {
      await addToClass.mutateAsync({
        turma_id: selectedTurmaId,
        student_ids: Array.from(selectedStudents),
      });
      toast.success(t('classes.toast.studentsAdded'));
      setShowAddToClassDialog(false);
      setSelectedStudents(new Set());
      setSelectedTurmaId('');
    } catch (error: any) {
      toast.error(error.message || t('classes.toast.addStudentsFailed'));
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b shadow-sm">
        <div className="max-w-6xl mx-auto p-4 lg:px-8 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold truncate">{t('classes.students.title')}</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 lg:px-8 space-y-4">
        {/* Search and Actions */}
        <div className="space-y-3">
          <div className="max-w-md">
            <Label htmlFor="student-search-class">{t('classes.students.classToSearch')}</Label>
            <Select value={searchTurmaId} onValueChange={setSearchTurmaId}>
              <SelectTrigger id="student-search-class" className="mt-1 min-h-[44px]">
                <SelectValue placeholder={t('classes.students.selectClassFirst')} />
              </SelectTrigger>
              <SelectContent>
                {turmas.map((turma: any) => (
                  <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={searchTurmaId ? t('classes.students.searchPlaceholder') : t('classes.students.searchDisabled')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 min-h-[44px]"
              disabled={!searchTurmaId}
            />
          </div>
          </div>
          {!searchTurmaId && (
            <p className="text-sm text-muted-foreground">
              {t('classes.students.searchHint')}
            </p>
          )}
        </div>

        {selectedStudents.size > 0 && (
          <Card className="p-4 border-border">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {t('classes.detail.selectedCount', { count: selectedStudents.size })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddToClassDialog(true)}
                  className="min-h-[40px]"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('classes.students.addToClass')}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Students List */}
        {students.length === 0 ? (
          <Card className="p-8 text-center border-border">
            <p className="text-muted-foreground">{t('classes.students.noStudents')}</p>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Checkbox
                checked={selectedStudents.size === students.length && students.length > 0}
                onCheckedChange={selectAll}
              />
              <span className="text-sm text-muted-foreground">{t('classes.students.selectAll')}</span>
            </div>

            {students.map((student: any) => (
              <Card key={student.aluno_id} className="p-4 border-border hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedStudents.has(student.aluno_id)}
                    onCheckedChange={() => toggleStudent(student.aluno_id)}
                    className="shrink-0"
                  />

                  <div className="shrink-0">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={student.avatar_url} />
                      <AvatarFallback className="text-base">{student.nome?.[0]?.toUpperCase() || 'A'}</AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{student.nome}</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground truncate">{student.ape_id}</span>
                        <span className="text-xs text-muted-foreground/60">• {student.status}</span>
                    </div>
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
            <DialogTitle>{t('classes.students.addToClass')}</DialogTitle>
            <DialogDescription>
              {t('classes.students.addDialogDesc', { count: selectedStudents.size })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('classes.students.classLabel')}</Label>
              <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('classes.students.selectClass')} />
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
                {t('common.cancel')}
              </Button>
              <Button onClick={handleAddToClass} disabled={addToClass.isPending}>
                {addToClass.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('classes.detail.adding')}
                  </>
                ) : (
                  t('common.add')
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
