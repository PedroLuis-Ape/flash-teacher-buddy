import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, MessageSquare, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { useClasses } from '@/hooks/useClasses';
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

  // Buscar tipo de usuário
  useState(() => {
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
  });

  const handleCreateClass = async () => {
    if (!className.trim()) {
      toast.error('Nome da turma é obrigatório');
      return;
    }

    if (className.length < 3 || className.length > 100) {
      toast.error('Nome deve ter entre 3 e 100 caracteres');
      return;
    }

    setCreating(true);
    const result = await createClass(className.trim());
    setCreating(false);

    if (result) {
      setShowCreateDialog(false);
      setClassName('');
      navigate(`/classes/${result.id}`);
    }
  };

  const handleJoinClass = async () => {
    if (!joinCode.trim()) {
      toast.error('Código da turma é obrigatório');
      return;
    }

    setJoining(true);
    const result = await joinClass(joinCode.trim());
    setJoining(false);

    if (result) {
      setShowJoinDialog(false);
      setJoinCode('');
      navigate(`/classes/${result.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando turmas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Turmas</h1>
                <p className="text-sm text-muted-foreground">
                  {classes.length} turma{classes.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              {userType === 'professor' && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Turma
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowJoinDialog(true)}>
                <Users className="h-4 w-4 mr-2" />
                Entrar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-4xl mx-auto px-4 py-6">
        {classes.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Sem turmas por enquanto</h2>
            <p className="text-muted-foreground mb-6">
              {userType === 'professor'
                ? 'Crie sua primeira turma ou entre em uma existente'
                : 'Entre em uma turma usando o código fornecido pelo professor'}
            </p>
            <div className="flex gap-2 justify-center">
              {userType === 'professor' && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Turma
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowJoinDialog(true)}>
                <Users className="h-4 w-4 mr-2" />
                Entrar em Turma
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {classes.map((cls) => (
              <Card
                key={cls.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/classes/${cls.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold">{cls.name}</h3>
                        <Badge variant={cls.role === 'teacher' ? 'default' : 'secondary'}>
                          {cls.role === 'teacher' ? 'Professor' : 'Aluno'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Código: <span className="font-mono font-semibold">{cls.code}</span>
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          <span>
                            {cls.unread_count > 0
                              ? `${cls.unread_count} nova${cls.unread_count > 1 ? 's' : ''}`
                              : 'Sem mensagens'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {cls.unread_count > 0 && (
                      <Badge variant="destructive" className="ml-4">
                        {cls.unread_count}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Class Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Turma</DialogTitle>
            <DialogDescription>
              Crie uma turma e compartilhe o código com seus alunos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome da Turma</Label>
              <Input
                id="name"
                placeholder="Ex: Matemática 2025"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateClass} disabled={creating}>
              {creating ? 'Criando...' : 'Criar Turma'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Class Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrar em Turma</DialogTitle>
            <DialogDescription>
              Digite o código da turma fornecido pelo professor.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Código da Turma</Label>
              <Input
                id="code"
                placeholder="Ex: APE-A1B2"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={10}
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleJoinClass} disabled={joining}>
              {joining ? 'Entrando...' : 'Entrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
