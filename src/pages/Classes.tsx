import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, MessageSquare, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useClasses, Class } from '@/hooks/useClasses';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { AnnouncementsList } from '@/components/AnnouncementsList';
import { CreateAnnouncementDialog } from '@/components/CreateAnnouncementDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Classes() {
  const navigate = useNavigate();
  const { classes, loading, createClass, joinClass } = useClasses();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [className, setClassName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [userType, setUserType] = useState<'professor' | 'aluno' | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  const {
    announcements,
    loading: announcementsLoading,
    hasMore,
    fetchAnnouncements,
    createAnnouncement,
    loadMore,
  } = useAnnouncements(selectedClass?.id || '');

  // Buscar tipo de usuário
  useEffect(() => {
    const fetchUserType = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', user.id)
          .single();
        
        setUserType(profile?.user_type || 'aluno');
      }
    };
    fetchUserType();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchAnnouncements();
    }
  }, [selectedClass, fetchAnnouncements]);

  const handleCreateClass = async () => {
    if (!className.trim()) {
      toast.error('Digite um nome para a turma');
      return;
    }

    try {
      setCreating(true);
      await createClass(className.trim());
      setShowCreateDialog(false);
      setClassName('');
      toast.success('Turma criada com sucesso!');
    } catch (error: any) {
      console.error('Error creating class:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinClass = async () => {
    if (!joinCode.trim()) {
      toast.error('Digite o código da turma');
      return;
    }

    try {
      setJoining(true);
      await joinClass(joinCode.trim());
      setShowJoinDialog(false);
      setJoinCode('');
      toast.success('Você entrou na turma!');
    } catch (error: any) {
      console.error('Error joining class:', error);
    } finally {
      setJoining(false);
    }
  };

  const handleAnnouncementClick = (announcement: any) => {
    navigate(`/announcements/${announcement.id}`);
  };

  // Separar turmas que sou owner das que sou membro
  const myClasses = classes.filter(c => c.owner_id === (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  }));
  const enrolledClasses = classes.filter(c => c.owner_id !== (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  }));

  // Vista de detalhe da turma com mural
  if (selectedClass) {
    return (
      <div className="min-h-screen bg-background p-4 pb-20">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => setSelectedClass(null)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold">{selectedClass.name}</h1>
            <p className="text-sm text-muted-foreground">
              {userType === 'professor' ? `Código: ${selectedClass.code}` : 'Membro'}
            </p>
          </div>

          <Tabs defaultValue="announcements">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="announcements">
                <MessageSquare className="h-4 w-4 mr-2" />
                Mural
              </TabsTrigger>
              <TabsTrigger value="members">
                <Users className="h-4 w-4 mr-2" />
                Alunos
              </TabsTrigger>
              <TabsTrigger value="messages">💬 Mensagens</TabsTrigger>
            </TabsList>

            <TabsContent value="announcements" className="mt-6">
              {userType === 'professor' && (
                <div className="mb-4">
                  <CreateAnnouncementDialog onSubmit={createAnnouncement} />
                </div>
              )}
              <AnnouncementsList
                announcements={announcements}
                onAnnouncementClick={handleAnnouncementClick}
                loading={announcementsLoading}
                hasMore={hasMore}
                onLoadMore={loadMore}
              />
            </TabsContent>

            <TabsContent value="members" className="mt-6">
              <p className="text-muted-foreground">
                Gerenciamento de alunos (em breve)
              </p>
            </TabsContent>

            <TabsContent value="messages" className="mt-6">
              <p className="text-muted-foreground">
                Mensagens 1:1 (em breve)
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // Lista de turmas
  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Minhas Turmas</h1>
          <div className="flex gap-2">
            {userType === 'professor' && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Turma
              </Button>
            )}
            {userType === 'aluno' && (
              <Button onClick={() => setShowJoinDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Entrar
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">
              {userType === 'professor'
                ? 'Você ainda não criou nenhuma turma'
                : 'Você ainda não está em nenhuma turma'}
            </p>
            {userType === 'professor' ? (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira turma
              </Button>
            ) : (
              <Button onClick={() => setShowJoinDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Entrar em uma turma
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {classes.map((cls) => (
              <Card
                key={cls.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedClass(cls)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-semibold">{cls.name}</h3>
                    <Badge variant={cls.visibility === 'public' ? 'default' : 'secondary'}>
                      {cls.visibility === 'public' ? 'Pública' : 'Privada'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Código: {cls.code}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>Ver alunos</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      <span>Mural</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dialog para criar turma */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Turma</DialogTitle>
              <DialogDescription>
                Crie uma turma para seus alunos. Você receberá um código para compartilhar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="className">Nome da turma</Label>
                <Input
                  id="className"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Ex: Inglês Básico - Turma A"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateClass();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateClass} disabled={creating || !className.trim()}>
                {creating ? 'Criando...' : 'Criar Turma'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para entrar em turma */}
        <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Entrar em uma Turma</DialogTitle>
              <DialogDescription>
                Digite o código fornecido pelo seu professor.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="joinCode">Código da turma</Label>
                <Input
                  id="joinCode"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Ex: APE-ABCD"
                  maxLength={8}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleJoinClass();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleJoinClass} disabled={joining || !joinCode.trim()}>
                {joining ? 'Entrando...' : 'Entrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
