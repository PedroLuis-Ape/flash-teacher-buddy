import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { naturalSort } from '@/lib/sorting';
import { ArrowLeft, Users as UsersIcon, BookOpen, MessageSquare, Settings, Plus, Pencil, Trash2, FolderOpen, Megaphone, BarChart2, CheckCircle2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MesaAvisos } from '@/components/MesaAvisos';
import { DMList } from '@/components/DMList';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAtribuicoesByTurma, useCreateAtribuicao, useDeleteAtribuicao, useUpdateAtribuicao } from '@/hooks/useAtribuicoes';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useUpdateTurma, useDeleteTurma, useEnrollAluno, useRemoveTurmaMember } from '@/hooks/useTurmas';
import { useCreateAnnouncement } from '@/hooks/useAnnouncements';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StudentAnalyticsModal } from '@/components/StudentAnalyticsModal';

export default function TurmaDetail() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Handle tab from URL params (for DM navigation from notifications)
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'atribuicoes');

  // Update tab when URL changes
  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrollApeId, setEnrollApeId] = useState('');

  const [atribDialogOpen, setAtribDialogOpen] = useState(false);
  const [atribTitulo, setAtribTitulo] = useState('');
  const [atribDescricao, setAtribDescricao] = useState('');
  const [atribFonteTipo, setAtribFonteTipo] = useState<'lista' | 'pasta'>('pasta');
  const [atribFonteId, setAtribFonteId] = useState('');
  const [atribPontos, setAtribPontos] = useState('50');

  // Edit atribuição state
  const [editAtribDialogOpen, setEditAtribDialogOpen] = useState(false);
  const [editAtribId, setEditAtribId] = useState<string | null>(null);
  const [editAtribTitulo, setEditAtribTitulo] = useState('');
  const [editAtribDescricao, setEditAtribDescricao] = useState('');
  const [editAtribPontos, setEditAtribPontos] = useState('50');

  // Announcement dialog state
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const [announcementTitulo, setAnnouncementTitulo] = useState('');
  const [announcementMensagem, setAnnouncementMensagem] = useState('');
  const [announcementMode, setAnnouncementMode] = useState<'general' | 'direct_assignment'>('general');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');

  // Student analytics state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  
  const updateTurma = useUpdateTurma();
  const deleteTurma = useDeleteTurma();
  const enrollAluno = useEnrollAluno();
  const createAtribuicao = useCreateAtribuicao();
  const deleteAtribuicao = useDeleteAtribuicao();
  const updateAtribuicao = useUpdateAtribuicao();
  const removeMember = useRemoveTurmaMember();
  const createAnnouncement = useCreateAnnouncement();

  const { data: turmaData, isLoading: turmaLoading } = useQuery({
    queryKey: ['turma', turmaId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: turma } = await supabase
        .from('turmas')
        .select('*, turma_membros(*)')
        .eq('id', turmaId)
        .single();

      // Attach profiles manually to avoid missing FK join in PostgREST
      let membrosWithProfiles = turma?.turma_membros || [];
      if (membrosWithProfiles && membrosWithProfiles.length > 0) {
        const ids = membrosWithProfiles.map((m: any) => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, avatar_skin_id, ape_id')
          .in('id', ids);
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        membrosWithProfiles = membrosWithProfiles.map((m: any) => ({
          ...m,
          profiles: profileMap.get(m.user_id) || null,
        }));
      }

      const turmaWithMembros = turma ? { ...turma, turma_membros: membrosWithProfiles } : null;

      const isOwner = turmaWithMembros?.owner_teacher_id === user.id;

      return { turma: turmaWithMembros, isOwner };
    },
  });

  const { data: atribuicoesData } = useAtribuicoesByTurma(turmaId || null);

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Buscar pastas e listas compartilhadas do professor
  const { data: fontesData } = useQuery({
    queryKey: ['fontes-atribuicao', turmaData?.turma?.owner_teacher_id],
    queryFn: async () => {
      if (!turmaData?.turma?.owner_teacher_id) return { pastas: [], listas: [] };

      // Order folders alphabetically (title ASC) for teaching sequence
      const { data: pastas } = await supabase
        .from('folders')
        .select('id, title, description')
        .eq('owner_id', turmaData.turma.owner_teacher_id)
        .eq('visibility', 'class')
        .order('title', { ascending: true });

      // Order lists alphabetically (title ASC) for teaching sequence
      const { data: listas } = await supabase
        .from('lists')
        .select('id, title, description, folder_id')
        .eq('owner_id', turmaData.turma.owner_teacher_id)
        .eq('visibility', 'class')
        .order('title', { ascending: true });

      return {
        pastas: pastas || [],
        listas: listas || [],
      };
    },
    enabled: !!turmaData?.turma?.owner_teacher_id,
  });

  // Buscar alunos inscritos no professor
  const { data: meusAlunosData } = useQuery({
    queryKey: ['meus-alunos-inscritos', currentUser?.id, turmaId, turmaData?.turma?.turma_membros],
    queryFn: async () => {
      if (!currentUser?.id || !turmaData?.turma) return [];

      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('student_id')
        .eq('teacher_id', currentUser.id);

      if (!subscriptions || subscriptions.length === 0) return [];

      const studentIds = subscriptions.map(s => s.student_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, ape_id, avatar_skin_id')
        .in('id', studentIds)
        .order('first_name', { ascending: true });

      // Filtrar alunos que já estão na turma
      const membros = turmaData.turma.turma_membros || [];
      const alunosNaTurma = new Set(membros.map((m: any) => m.user_id));
      return (profiles || []).filter(p => !alunosNaTurma.has(p.id));
    },
    enabled: !!currentUser?.id && !!turmaData?.isOwner && !!turmaId,
  });

  if (turmaLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const turma = turmaData?.turma;
  const isOwner = turmaData?.isOwner || false;

  if (!turma) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Turma não encontrada</p>
      </div>
    );
  }

  // Apply natural sort to atribuições for correct ordering (1, 2, 10 not 1, 10, 2)
  const atribuicoes = naturalSort(atribuicoesData?.atribuicoes || [], (a: any) => a.titulo);
  const membros = turma.turma_membros || [];

  const handleOpenEdit = () => {
    setEditNome(turma?.nome || '');
    setEditDescricao(turma?.descricao || '');
    setEditDialogOpen(true);
  };

  const handleUpdateTurma = async () => {
    if (!turmaId || !editNome.trim()) {
      toast.error('❌ Nome é obrigatório');
      return;
    }

    try {
      await updateTurma.mutateAsync({
        turma_id: turmaId,
        nome: editNome,
        descricao: editDescricao,
      });
      toast.success('✅ Turma atualizada!');
      setEditDialogOpen(false);
    } catch (error) {
      toast.error('❌ Erro ao atualizar turma');
    }
  };

  const handleDeleteTurma = async () => {
    if (!turmaId) return;

    try {
      await deleteTurma.mutateAsync(turmaId);
      toast.success('✅ Turma deletada!');
      navigate('/turmas/professor');
    } catch (error) {
      toast.error('❌ Erro ao deletar turma');
    }
  };

  const handleEnrollAluno = async (apeId?: string) => {
    const idToUse = apeId || enrollApeId;
    
    if (!turmaId || !idToUse.trim()) {
      toast.error('❌ APE ID é obrigatório');
      return;
    }

    try {
      await enrollAluno.mutateAsync({
        turma_id: turmaId,
        ape_id: idToUse,
      });
      toast.success('✅ Aluno matriculado!');
      setEnrollDialogOpen(false);
      setEnrollApeId('');
    } catch (error: any) {
      toast.error(`❌ ${error.message || 'Erro ao matricular aluno'}`);
    }
  };

  const handleCreateAtribuicao = async () => {
    if (!turmaId || !atribTitulo.trim() || !atribFonteId) {
      toast.error('❌ Preencha todos os campos obrigatórios');
      return;
    }

    try {
      await createAtribuicao.mutateAsync({
        turma_id: turmaId,
        titulo: atribTitulo,
        descricao: atribDescricao,
        fonte_tipo: atribFonteTipo,
        fonte_id: atribFonteId,
        pontos_vale: parseInt(atribPontos) || 50,
      });
      toast.success('✅ Atribuição criada!');
      setAtribDialogOpen(false);
      setAtribTitulo('');
      setAtribDescricao('');
      setAtribFonteId('');
      setAtribPontos('50');
    } catch (error: any) {
      toast.error(`❌ ${error.message || 'Erro ao criar atribuição'}`);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!turmaId || !announcementTitulo.trim() || !announcementMensagem.trim()) {
      toast.error('❌ Preencha todos os campos');
      return;
    }

    // Additional validation for direct_assignment mode
    if (announcementMode === 'direct_assignment') {
      if (selectedStudentIds.length === 0) {
        toast.error('❌ Selecione pelo menos um aluno');
        return;
      }
      if (!selectedAssignmentId) {
        toast.error('❌ Selecione uma atribuição');
        return;
      }
    }

    try {
      await createAnnouncement.mutateAsync({
        class_id: turmaId,
        title: announcementTitulo,
        body: announcementMensagem,
        mode: announcementMode,
        target_student_ids: announcementMode === 'direct_assignment' ? selectedStudentIds : undefined,
        assignment_id: announcementMode === 'direct_assignment' ? selectedAssignmentId : undefined,
      });
      
      const successMessage = announcementMode === 'direct_assignment'
        ? `✅ Aviso enviado para ${selectedStudentIds.length} aluno(s)!`
        : '✅ Aviso enviado para todos os alunos!';
      toast.success(successMessage);
      
      // Reset form
      setAnnouncementDialogOpen(false);
      setAnnouncementTitulo('');
      setAnnouncementMensagem('');
      setAnnouncementMode('general');
      setSelectedStudentIds([]);
      setSelectedAssignmentId('');
    } catch (error: any) {
      toast.error(`❌ ${error.message || 'Erro ao criar aviso'}`);
    }
  };


  const handleOpenEditAtrib = (atrib: any) => {
    setEditAtribId(atrib.id);
    setEditAtribTitulo(atrib.titulo);
    setEditAtribDescricao(atrib.descricao || '');
    setEditAtribPontos(String(atrib.pontos_vale || 50));
    setEditAtribDialogOpen(true);
  };

  const handleUpdateAtribuicao = async () => {
    if (!editAtribId || !editAtribTitulo.trim()) {
      toast.error('❌ Título é obrigatório');
      return;
    }

    try {
      await updateAtribuicao.mutateAsync({
        atribuicao_id: editAtribId,
        titulo: editAtribTitulo,
        descricao: editAtribDescricao,
        pontos_vale: parseInt(editAtribPontos) || 50,
      });
      toast.success('✅ Atribuição atualizada!');
      setEditAtribDialogOpen(false);
      setEditAtribId(null);
    } catch (error: any) {
      toast.error(`❌ ${error.message || 'Erro ao atualizar atribuição'}`);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="max-w-6xl mx-auto lg:px-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{turma.nome}</h1>
              {turma.descricao && (
                <p className="text-sm text-muted-foreground">{turma.descricao}</p>
              )}
            </div>
            {isOwner && (
              <div className="flex gap-2">
                <Button variant="default" size="sm" onClick={() => setAnnouncementDialogOpen(true)}>
                  <Megaphone className="h-4 w-4 mr-2" />
                  Aviso
                </Button>
                <Button variant="outline" size="sm" onClick={handleOpenEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Deletar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja deletar esta turma? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteTurma}>
                        Deletar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Announcement Dialog */}
      <Dialog open={announcementDialogOpen} onOpenChange={(open) => {
        setAnnouncementDialogOpen(open);
        if (!open) {
          // Reset form when closing
          setAnnouncementTitulo('');
          setAnnouncementMensagem('');
          setAnnouncementMode('general');
          setSelectedStudentIds([]);
          setSelectedAssignmentId('');
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Criar Aviso da Turma
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Mode selector */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <Button
                variant={announcementMode === 'general' ? 'default' : 'ghost'}
                className="flex-1"
                size="sm"
                onClick={() => setAnnouncementMode('general')}
              >
                <UsersIcon className="h-4 w-4 mr-2" />
                Aviso Geral
              </Button>
              <Button
                variant={announcementMode === 'direct_assignment' ? 'default' : 'ghost'}
                className="flex-1"
                size="sm"
                onClick={() => setAnnouncementMode('direct_assignment')}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Atribuição Direta
              </Button>
            </div>
            
            {/* Title */}
            <div>
              <Label htmlFor="announcement-titulo">Título *</Label>
              <Input
                id="announcement-titulo"
                value={announcementTitulo}
                onChange={(e) => setAnnouncementTitulo(e.target.value)}
                placeholder="Ex: Prova na próxima semana"
                maxLength={200}
              />
            </div>
            
            {/* Message */}
            <div>
              <Label htmlFor="announcement-mensagem">Mensagem *</Label>
              <Textarea
                id="announcement-mensagem"
                value={announcementMensagem}
                onChange={(e) => setAnnouncementMensagem(e.target.value)}
                placeholder="Digite a mensagem..."
                rows={4}
                maxLength={5000}
              />
            </div>
            
            {/* Mode-specific content */}
            {announcementMode === 'general' ? (
              <div className="p-4 bg-muted/50 rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <UsersIcon className="h-4 w-4" />
                  Este aviso será enviado para <strong>todos os {membros.length} alunos</strong> da turma.
                </p>
              </div>
            ) : (
              <>
                {/* Student selection */}
                <div>
                  <Label className="mb-2 block">Selecionar Alunos *</Label>
                  {membros.length > 0 ? (
                    <ScrollArea className="h-[150px] border rounded-lg p-2">
                      <div className="space-y-1">
                        {membros.map((membro: any) => {
                          const profile = membro.profiles;
                          const isSelected = selectedStudentIds.includes(membro.user_id);
                          return (
                            <div
                              key={membro.user_id}
                              className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                                isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'
                              }`}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedStudentIds(prev => prev.filter(id => id !== membro.user_id));
                                } else {
                                  setSelectedStudentIds(prev => [...prev, membro.user_id]);
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                                  isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'
                                }`}>
                                  {isSelected && <CheckCircle2 className="h-3 w-3" />}
                                </div>
                                <span className="font-medium">{profile?.first_name || 'Aluno'}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {profile?.ape_id || 'N/A'}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground p-4 border rounded-lg">
                      Nenhum aluno matriculado na turma.
                    </p>
                  )}
                  {selectedStudentIds.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedStudentIds.length} aluno(s) selecionado(s)
                    </p>
                  )}
                </div>
                
                {/* Assignment selection */}
                <div>
                  <Label htmlFor="announcement-atribuicao">Atribuição Vinculada *</Label>
                  <Select value={selectedAssignmentId} onValueChange={setSelectedAssignmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma atribuição" />
                    </SelectTrigger>
                    <SelectContent>
                      {atribuicoes && atribuicoes.length > 0 ? (
                        atribuicoes.map((atrib: any) => (
                          <SelectItem key={atrib.id} value={atrib.id}>
                            {atrib.titulo}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          Nenhuma atribuição disponível
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnouncementDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateAnnouncement} 
              disabled={
                createAnnouncement.isPending || 
                !announcementTitulo.trim() || 
                !announcementMensagem.trim() ||
                (announcementMode === 'direct_assignment' && (selectedStudentIds.length === 0 || !selectedAssignmentId))
              }
            >
              {createAnnouncement.isPending 
                ? 'Enviando...' 
                : announcementMode === 'general' 
                  ? 'Enviar Aviso Geral' 
                  : `Enviar para ${selectedStudentIds.length} aluno(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Turma</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-nome">Nome da Turma</Label>
              <Input
                id="edit-nome"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                placeholder="Ex: Inglês Básico"
              />
            </div>
            <div>
              <Label htmlFor="edit-descricao">Descrição</Label>
              <Textarea
                id="edit-descricao"
                value={editDescricao}
                onChange={(e) => setEditDescricao(e.target.value)}
                placeholder="Descrição da turma..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateTurma} disabled={updateTurma.isPending}>
              {updateTurma.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Adicionar Aluno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Lista de alunos inscritos */}
            {meusAlunosData && meusAlunosData.length > 0 && (
              <div>
                <Label className="mb-2 block">Meus Alunos Inscritos</Label>
                <ScrollArea className="h-[200px] border rounded-lg p-2">
                  <div className="space-y-1">
                    {meusAlunosData.map((aluno: any) => (
                      <div
                        key={aluno.id}
                        className="flex items-center justify-between p-3 rounded hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => handleEnrollAluno(aluno.ape_id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-lg font-semibold text-primary">
                              {aluno.first_name?.[0] || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{aluno.first_name}</p>
                            <p className="text-xs text-muted-foreground">
                              APE: {aluno.ape_id}
                            </p>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEnrollAluno(aluno.ape_id);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Separador */}
            {meusAlunosData && meusAlunosData.length > 0 && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Ou digite o APE ID
                  </span>
                </div>
              </div>
            )}

            {/* Input manual */}
            <div>
              <Label htmlFor="enroll-ape-id">APE ID do Aluno</Label>
              <Input
                id="enroll-ape-id"
                value={enrollApeId}
                onChange={(e) => setEnrollApeId(e.target.value)}
                placeholder="Ex: ABC12345"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && enrollApeId.trim()) {
                    handleEnrollAluno();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => handleEnrollAluno()} disabled={enrollAluno.isPending || !enrollApeId.trim()}>
              {enrollAluno.isPending ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Atribuição Dialog */}
      <Dialog open={atribDialogOpen} onOpenChange={setAtribDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar Atribuição</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="atrib-titulo">Título *</Label>
              <Input
                id="atrib-titulo"
                value={atribTitulo}
                onChange={(e) => setAtribTitulo(e.target.value)}
                placeholder="Ex: Estudar verbos irregulares"
              />
            </div>
            <div>
              <Label htmlFor="atrib-descricao">Descrição</Label>
              <Textarea
                id="atrib-descricao"
                value={atribDescricao}
                onChange={(e) => setAtribDescricao(e.target.value)}
                placeholder="Instruções para os alunos..."
                rows={3}
              />
            </div>
            <div>
              <Label>Tipo de Conteúdo *</Label>
              <Select value={atribFonteTipo} onValueChange={(v: any) => {
                setAtribFonteTipo(v);
                setAtribFonteId(''); // Reset selection
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pasta">Pasta</SelectItem>
                  <SelectItem value="lista">Lista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Selecione o Conteúdo *</Label>
              <Select value={atribFonteId} onValueChange={setAtribFonteId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Selecione ${atribFonteTipo === 'pasta' ? 'uma pasta' : 'uma lista'}`} />
                </SelectTrigger>
                <SelectContent>
                  {atribFonteTipo === 'pasta' ? (
                    (fontesData?.pastas || []).length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        Nenhuma pasta compartilhada encontrada.
                        <br />
                        Crie uma pasta e defina visibilidade como "Turma".
                      </div>
                    ) : (
                      (fontesData?.pastas || []).map((pasta: any) => (
                        <SelectItem key={pasta.id} value={pasta.id}>
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4" />
                            <span>{pasta.title}</span>
                          </div>
                        </SelectItem>
                      ))
                    )
                  ) : (
                    (fontesData?.listas || []).length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        Nenhuma lista compartilhada encontrada.
                        <br />
                        Crie uma lista e defina visibilidade como "Turma".
                      </div>
                    ) : (
                      (fontesData?.listas || []).map((lista: any) => (
                        <SelectItem key={lista.id} value={lista.id}>
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            <span>{lista.title}</span>
                          </div>
                        </SelectItem>
                      ))
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="atrib-pontos">Pontos *</Label>
              <Input
                id="atrib-pontos"
                type="number"
                value={atribPontos}
                onChange={(e) => setAtribPontos(e.target.value)}
                placeholder="50"
                min="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtribDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateAtribuicao} disabled={createAtribuicao.isPending}>
              {createAtribuicao.isPending ? 'Criando...' : 'Criar Atribuição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Atribuição Dialog */}
      <Dialog open={editAtribDialogOpen} onOpenChange={setEditAtribDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Atribuição</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-atrib-titulo">Título *</Label>
              <Input
                id="edit-atrib-titulo"
                value={editAtribTitulo}
                onChange={(e) => setEditAtribTitulo(e.target.value)}
                placeholder="Ex: Estudar verbos irregulares"
              />
            </div>
            <div>
              <Label htmlFor="edit-atrib-descricao">Descrição</Label>
              <Textarea
                id="edit-atrib-descricao"
                value={editAtribDescricao}
                onChange={(e) => setEditAtribDescricao(e.target.value)}
                placeholder="Instruções para os alunos..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-atrib-pontos">Pontos *</Label>
              <Input
                id="edit-atrib-pontos"
                type="number"
                value={editAtribPontos}
                onChange={(e) => setEditAtribPontos(e.target.value)}
                placeholder="50"
                min="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAtribDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateAtribuicao} disabled={updateAtribuicao.isPending}>
              {updateAtribuicao.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-6xl mx-auto p-4 lg:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="atribuicoes">
              <BookOpen className="h-4 w-4 mr-2" />
              Atribuições
            </TabsTrigger>
            <TabsTrigger value="avisos">
              <Megaphone className="h-4 w-4 mr-2" />
              Avisos
            </TabsTrigger>
            <TabsTrigger value="pessoas">
              <UsersIcon className="h-4 w-4 mr-2" />
              Pessoas
            </TabsTrigger>
            <TabsTrigger value="mensagens">
              <MessageSquare className="h-4 w-4 mr-2" />
              Mensagens
            </TabsTrigger>
          </TabsList>

          <TabsContent value="atribuicoes" className="space-y-4 mt-4">
            {isOwner && (
              <Button className="w-full" onClick={() => setAtribDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Atribuição
              </Button>
            )}
            {atribuicoes.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Nenhuma atribuição ainda.</p>
              </Card>
            ) : (
              atribuicoes.map((atrib: any) => (
                <Card
                  key={atrib.id}
                  className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => {
                    // Navigate directly to content (skip intermediate screen)
                    if (atrib.fonte_tipo === 'lista') {
                      navigate(`/list/${atrib.fonte_id}/games`);
                    } else if (atrib.fonte_tipo === 'pasta') {
                      navigate(`/folder/${atrib.fonte_id}`);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <h3 className="font-semibold truncate" title={atrib.titulo}>{atrib.titulo}</h3>
                      {atrib.descricao && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{atrib.descricao}</p>
                      )}
                    </div>
                    {isOwner && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditAtrib(atrib);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deletar atribuição</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja deletar "{atrib.titulo}"? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={async () => {
                                  try {
                                    await deleteAtribuicao.mutateAsync(atrib.id);
                                    toast.success('✅ Atribuição deletada!');
                                  } catch (error) {
                                    toast.error('❌ Erro ao deletar atribuição');
                                  }
                                }}
                              >
                                Deletar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant="outline">{atrib.fonte_tipo}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {atrib.pontos_vale} pontos
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {atrib.card_count ?? 0} cards
                    </span>
                    {atrib.progresso && (
                      <span className="text-sm text-muted-foreground ml-auto">
                        ✓ {atrib.progresso.concluidas} / {atrib.progresso.total_alunos}
                      </span>
                    )}
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="avisos" className="mt-4">
            <MesaAvisos turmaId={turmaId || ''} isOwner={isOwner} />
          </TabsContent>

          <TabsContent value="pessoas" className="space-y-4 mt-4">
            {isOwner && (
              <Button className="w-full" onClick={() => setEnrollDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Aluno
              </Button>
            )}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Membros ({membros.length})</h3>
              <div className="space-y-2">
                {membros.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhum membro ainda.</p>
                ) : (
                  membros.map((membro: any) => (
                    <div key={membro.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                      <div>
                        <p className="font-medium">{membro.profiles?.first_name || 'Sem nome'}</p>
                        <p className="text-xs text-muted-foreground">
                          APE ID: {membro.profiles?.ape_id || 'N/A'}
                        </p>
                      </div>
                        <div className="flex items-center gap-2">
                        <Badge variant={membro.role === 'aluno' ? 'secondary' : 'default'}>
                          {membro.role}
                        </Badge>
                        {isOwner && membro.role === 'aluno' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Ver desempenho"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => {
                                setSelectedStudentId(membro.user_id);
                                setAnalyticsOpen(true);
                              }}
                            >
                              <BarChart2 className="h-4 w-4" />
                            </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover aluno</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover {membro.profiles?.first_name || 'este aluno'} da turma?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                                  onClick={async () => {
                                    // OPTIMISTIC UPDATE: Remove from UI immediately
                                    const previousMembros = turma.turma_membros;
                                    turma.turma_membros = turma.turma_membros.filter(
                                      (m: any) => m.user_id !== membro.user_id
                                    );
                                    
                                    try {
                                      await removeMember.mutateAsync({
                                        turma_id: turmaId!,
                                        user_id: membro.user_id
                                      });
                                      toast.success('✅ Aluno removido!');
                                    } catch (error) {
                                      // Rollback on error
                                      turma.turma_membros = previousMembros;
                                      toast.error('❌ Erro ao remover aluno');
                                    }
                                  }}
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="mensagens" className="mt-4">
            <DMList 
              turmaId={turmaId || ''} 
              isOwner={isOwner} 
              membros={membros}
              teacherId={turma.owner_teacher_id}
              teacherName="Professor"
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Student Analytics Modal */}
      <StudentAnalyticsModal
        studentId={selectedStudentId}
        isOpen={analyticsOpen}
        onClose={() => {
          setAnalyticsOpen(false);
          setSelectedStudentId(null);
        }}
      />
    </div>
  );
}