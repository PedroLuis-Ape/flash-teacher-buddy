import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTurmasMine, useTurmasAsAluno } from '@/hooks/useTurmas';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Turmas() {
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('profiles')
        .select('is_teacher')
        .eq('id', user.id)
        .single();

      return data;
    },
  });

  const { data: professorData, isLoading: professorLoading } = useTurmasMine();
  const { data: alunoData, isLoading: alunoLoading } = useTurmasAsAluno();

  const isTeacher = profile?.is_teacher || false;
  const turmasProfessor = professorData?.turmas || [];
  const turmasAluno = alunoData?.turmas || [];

  if (professorLoading || alunoLoading) {
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
          <h1 className="text-2xl font-bold">Turmas</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {isTeacher ? (
          <Tabs defaultValue="professor">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="professor">Como Professor</TabsTrigger>
              <TabsTrigger value="aluno">Como Aluno</TabsTrigger>
            </TabsList>

            <TabsContent value="professor" className="space-y-4 mt-4">
              <Button onClick={() => navigate('/turmas/professor')} className="w-full min-h-[48px]">
                <Plus className="h-4 w-4 mr-2" />
                Criar Nova Turma
              </Button>
              {turmasProfessor.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">Nenhuma turma criada ainda.</p>
                </Card>
              ) : (
                turmasProfessor.map((turma: any) => (
                  <Card
                    key={turma.id}
                    className="p-6 relative group hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => navigate(`/turmas/${turma.id}`)}
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-4 right-4 opacity-70 hover:opacity-100 h-10 w-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/turmas/${turma.id}`);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <div className="pr-12">
                      <h3 className="text-lg font-semibold">{turma.nome}</h3>
                      {turma.descricao && (
                        <p className="text-sm text-muted-foreground mt-1">{turma.descricao}</p>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="aluno" className="space-y-4 mt-4">
              {turmasAluno.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">Nenhuma turma matriculada.</p>
                </Card>
              ) : (
                turmasAluno.map((turma: any) => (
                  <Card
                    key={turma.id}
                    className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate(`/turmas/${turma.id}`)}
                  >
                    <h3 className="text-lg font-semibold">{turma.nome}</h3>
                    {turma.descricao && (
                      <p className="text-sm text-muted-foreground mt-1">{turma.descricao}</p>
                    )}
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            {turmasAluno.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Nenhuma turma matriculada.</p>
              </Card>
            ) : (
              turmasAluno.map((turma: any) => (
                <Card
                  key={turma.id}
                  className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/turmas/${turma.id}`)}
                >
                  <h3 className="text-lg font-semibold">{turma.nome}</h3>
                  {turma.descricao && (
                    <p className="text-sm text-muted-foreground mt-1">{turma.descricao}</p>
                  )}
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}