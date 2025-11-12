import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users as UsersIcon, BookOpen, MessageSquare, Settings, Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAtribuicoesByTurma, useCreateAtribuicao } from '@/hooks/useAtribuicoes';
import { useChatMessages, useSendMessage } from '@/hooks/useMensagens';
import { ChatComposer } from '@/components/ChatComposer';
import { MessageBubble } from '@/components/MessageBubble';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useUpdateTurma, useDeleteTurma, useEnrollAluno } from '@/hooks/useTurmas';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TurmaDetail() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('atribuicoes');
  
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
  
  const updateTurma = useUpdateTurma();
  const deleteTurma = useDeleteTurma();
  const enrollAluno = useEnrollAluno();
  const createAtribuicao = useCreateAtribuicao();

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
  const { data: chatData } = useChatMessages(turmaId || null, 'turma', turmaId || '');
  const sendMessage = useSendMessage();

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

      const { data: pastas } = await supabase
        .from('folders')
        .select('id, title, description')
        .eq('owner_id', turmaData.turma.owner_teacher_id)
        .eq('visibility', 'class')
        .order('created_at', { ascending: false });

      const { data: listas } = await supabase
        .from('lists')
        .select('id, title, description, folder_id')
        .eq('owner_id', turmaData.turma.owner_teacher_id)
        .eq('visibility', 'class')
        .order('created_at', { ascending: false });

      return {
        pastas: pastas || [],
        listas: listas || [],
      };
    },
    enabled: !!turmaData?.turma?.owner_teacher_id,
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

  const atribuicoes = atribuicoesData?.atribuicoes || [];
  const messages = chatData?.messages || [];
  const membros = turma.turma_membros || [];

  const handleSendMessage = async (texto: string) => {
    if (!turmaId) return;
    await sendMessage.mutateAsync({
      turma_id: turmaId,
      thread_tipo: 'turma',
      thread_chave: turmaId,
      texto,
    });
  };

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

  const handleEnrollAluno = async () => {
    if (!turmaId || !enrollApeId.trim()) {
      toast.error('❌ APE ID é obrigatório');
      return;
    }

    try {
      await enrollAluno.mutateAsync({
        turma_id: turmaId,
        ape_id: enrollApeId,
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

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/turmas/professor')}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Aluno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="enroll-ape-id">APE ID do Aluno</Label>
              <Input
                id="enroll-ape-id"
                value={enrollApeId}
                onChange={(e) => setEnrollApeId(e.target.value)}
                placeholder="Ex: ABC12345"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEnrollAluno} disabled={enrollAluno.isPending}>
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

      <div className="max-w-4xl mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="atribuicoes">
              <BookOpen className="h-4 w-4 mr-2" />
              Atribuições
            </TabsTrigger>
            <TabsTrigger value="pessoas">
              <UsersIcon className="h-4 w-4 mr-2" />
              Pessoas
            </TabsTrigger>
            <TabsTrigger value="chat">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
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
                  className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/turmas/${turmaId}/atribuicoes/${atrib.id}`)}
                >
                  <h3 className="font-semibold">{atrib.titulo}</h3>
                  {atrib.descricao && (
                    <p className="text-sm text-muted-foreground mt-1">{atrib.descricao}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant="outline">{atrib.fonte_tipo}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {atrib.pontos_vale} pontos
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
                      <Badge variant={membro.role === 'aluno' ? 'secondary' : 'default'}>
                        {membro.role}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <Card className="h-[500px] flex flex-col">
              <ScrollArea className="flex-1 p-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhuma mensagem ainda.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Seja o primeiro a enviar uma mensagem!
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col-reverse">
                    {messages.map((msg: any) => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        isOwn={msg.sender_id === currentUser?.id}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
              <ChatComposer onSend={handleSendMessage} />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}