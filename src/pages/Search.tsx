import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Search as SearchIcon, SearchX } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthUser } from '@/hooks/useAuthUser';
import { supabase } from '@/integrations/supabase/client';

interface TeacherResult {
  public_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  is_teacher: boolean;
  membership_status: string | null;
}

export default function Search() {
  const navigate = useNavigate();
  const { userId, isLoading: authLoading } = useAuthUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [submittedTerm, setSubmittedTerm] = useState('');
  const [searchType, setSearchType] = useState<'professor' | 'aluno'>('professor');

  useEffect(() => {
    if (!authLoading && !userId) navigate('/auth', { replace: true });
  }, [authLoading, navigate, userId]);

  const teacherQuery = useQuery({
    queryKey: ['teacher-directory-search', userId, submittedTerm],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_turma_people_v1', {
        p_kind: 'teacher',
        p_query: submittedTerm,
        p_limit: 20,
        p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as TeacherResult[];
    },
    enabled: Boolean(userId && searchType === 'professor' && submittedTerm.length >= 2),
    retry: false,
  });

  const submitSearch = () => {
    const normalized = searchTerm.trim().replace(/\s+/g, ' ');
    if (normalized.length < 2) return;
    setSubmittedTerm(normalized);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background p-4 text-center text-muted-foreground">Carregando busca...</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 border-b bg-background p-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4 lg:px-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Buscar</h1>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-6 p-4 lg:px-8">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                type="search"
                placeholder="Nome, username ou identificador público..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && submitSearch()}
                className="min-h-[44px] flex-1"
                disabled={searchType === 'aluno'}
              />
              <Button
                onClick={submitSearch}
                disabled={searchType === 'aluno' || teacherQuery.isFetching || searchTerm.trim().length < 2}
                className="min-h-[44px] w-full sm:w-auto"
              >
                <SearchIcon className="mr-2 h-4 w-4" />
                {teacherQuery.isFetching ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>

            <Tabs value={searchType} onValueChange={(value) => setSearchType(value as typeof searchType)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="professor">Professores</TabsTrigger>
                <TabsTrigger value="aluno">Alunos</TabsTrigger>
              </TabsList>
            </Tabs>

            {searchType === 'aluno' && (
              <p className="text-sm text-muted-foreground">
                A busca de alunos é restrita a uma turma no painel do professor para evitar a exposição de contas.
              </p>
            )}
            {searchType === 'professor' && (
              <p className="text-sm text-muted-foreground">
                Apenas perfis de professores publicados e pesquisáveis aparecem aqui. Digite pelo menos 2 caracteres.
              </p>
            )}
          </CardContent>
        </Card>

        {teacherQuery.isError && (
          <Card className="border-destructive/40 p-6">
            <p className="font-semibold">Não foi possível realizar a busca.</p>
            <p className="mt-1 text-sm text-muted-foreground">O servidor não respondeu. Tente novamente sem perder o termo.</p>
            <Button className="mt-4" variant="outline" onClick={() => void teacherQuery.refetch()}>Tentar novamente</Button>
          </Card>
        )}

        {searchType === 'professor' && submittedTerm.length >= 2 && !teacherQuery.isLoading && !teacherQuery.isError && (
          teacherQuery.data?.length ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Professores encontrados ({teacherQuery.data.length})</h2>
              <div className="grid gap-3">
                {teacherQuery.data.map((teacher) => (
                  <Card
                    key={teacher.public_id}
                    className="cursor-pointer transition-shadow hover:shadow-lg"
                    onClick={() => navigate(`/portal/professor/${teacher.public_id}`)}
                  >
                    <CardHeader className="py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <GraduationCap className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="truncate text-base">{teacher.display_name}</CardTitle>
                            <CardDescription className="truncate">
                              {teacher.username ? `@${teacher.username}` : 'Perfil público'}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge>Professor</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button variant="outline" className="w-full" onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/portal/professor/${teacher.public_id}`);
                      }}>
                        Abrir perfil público
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card className="p-8 text-center">
              <SearchX className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum professor público encontrado.</p>
            </Card>
          )
        )}
      </main>
    </div>
  );
}
