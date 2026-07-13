import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, FolderOpen, Gamepad2, GraduationCap, Layers3, School, SearchX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ApeCardFolder } from '@/components/ape/ApeCardFolder';
import { ApeGrid } from '@/components/ape/ApeGrid';
import { AuthAwareCTA } from '@/components/auth/AuthAwareLink';
import { PublicPageHeader } from '@/components/seo/PublicPageHeader';
import { SEOHead } from '@/components/seo/SEOHead';
import { buildPublicTeacherStructuredData } from '@/components/seo/publicTeacherStructuredData';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PublicTeacherProfileRow {
  display_name: string;
  avatar_url: string | null;
  public_slug: string;
  public_bio: string | null;
  public_specialties: string[] | null;
  folder_count: number | string;
  list_count: number | string;
  card_count: number | string;
}

interface PublicTeacherFolderRow {
  id: string;
  title: string;
  description: string | null;
  list_count: number | string;
  card_count: number | string;
}

interface PublicTeacherTurmaRow {
  id: string;
  nome: string;
  descricao: string | null;
  assignment_count: number | string;
  card_count: number | string;
  created_at: string;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'P';
}

function asNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export default function PublicTeacherProfile() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const profileQuery = useQuery({
    queryKey: ['public-teacher-profile', slug],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_public_teacher_profile', { _slug: slug });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) return row as PublicTeacherProfileRow;

      // Compatibilidade com bancos que ainda usam a implementação antiga do
      // perfil, limitada aos primeiros 24 professores do diretório.
      const legacy = await (supabase.rpc as any)('search_public_teachers', {
        _q: slug,
        _limit: 24,
      });
      if (legacy.error) throw legacy.error;
      const exact = (legacy.data ?? []).find(
        (candidate: PublicTeacherProfileRow) => candidate.public_slug.toLocaleLowerCase('en-US') === slug.toLocaleLowerCase('en-US'),
      );
      return (exact ?? null) as PublicTeacherProfileRow | null;
    },
    enabled: Boolean(slug),
    retry: false,
    staleTime: 60_000,
  });

  const foldersQuery = useQuery({
    queryKey: ['public-teacher-folders', slug],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_public_teacher_folders', { _slug: slug });
      if (error) throw error;
      return (data ?? []) as PublicTeacherFolderRow[];
    },
    enabled: Boolean(slug && profileQuery.data),
    retry: false,
    staleTime: 60_000,
  });

  const turmasQuery = useQuery({
    queryKey: ['public-teacher-turmas', slug],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_public_teacher_turmas', { _slug: slug });
      if (error) throw error;
      return (data ?? []) as PublicTeacherTurmaRow[];
    },
    enabled: Boolean(slug && profileQuery.data),
    retry: false,
    staleTime: 60_000,
  });

  const profile = profileQuery.data ?? null;
  const specialties = useMemo(() => profile?.public_specialties?.filter(Boolean) ?? [], [profile]);
  const folders = foldersQuery.data ?? [];
  const turmas = turmasQuery.data ?? [];

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicPageHeader title="Perfil público" fallbackPath="/portal" />
        <div className="mx-auto flex min-h-[40vh] max-w-6xl items-center justify-center px-4 text-muted-foreground">
          Carregando perfil do professor...
        </div>
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="min-h-screen bg-background">
        <SEOHead
          title="Perfil público temporariamente indisponível | APE"
          description="Não foi possível consultar este perfil público agora."
          path={`/portal/professor/${slug}`}
          canonicalPath={null}
          robots="noindex,nofollow"
        />
        <PublicPageHeader title="Perfil público" fallbackPath="/portal" />
        <main className="mx-auto max-w-3xl px-4 py-12">
          <Card className="p-8 text-center">
            <SearchX className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h1 className="text-xl font-bold">Perfil público indisponível</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Não foi possível consultar o diretório público agora. Tente novamente.
            </p>
            <Button className="mt-6" onClick={() => profileQuery.refetch()}>Tentar novamente</Button>
          </Card>
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <SEOHead
          title="Professor não encontrado | APE"
          description="Este perfil não existe, deixou de ser público ou ainda não foi publicado."
          path={`/portal/professor/${slug}`}
          canonicalPath={null}
          robots="noindex,nofollow"
        />
        <PublicPageHeader title="Perfil público" fallbackPath="/portal" />
        <main className="mx-auto max-w-3xl px-4 py-12">
          <Card className="p-8 text-center">
            <SearchX className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h1 className="text-xl font-bold">Professor não encontrado</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Este perfil não existe, deixou de ser público ou ainda não foi publicado.
            </p>
            <Button className="mt-6" onClick={() => navigate('/portal')}>Voltar ao portal</Button>
          </Card>
        </main>
      </div>
    );
  }

  const folderCount = asNumber(profile.folder_count);
  const listCount = asNumber(profile.list_count);
  const cardCount = asNumber(profile.card_count);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${profile.display_name} | Materiais públicos de inglês`}
        description={profile.public_bio || `Explore materiais públicos de inglês compartilhados por ${profile.display_name}.`}
        path={`/portal/professor/${profile.public_slug}`}
        image={profile.avatar_url || undefined}
        imageAlt={`Foto ou identidade visual de ${profile.display_name}`}
        jsonLd={buildPublicTeacherStructuredData(profile, folders)}
      />

      <PublicPageHeader title="Perfil do professor" fallbackPath="/portal" />

      <main className="container mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-4 sm:px-6">
        <Card className="border-primary/20 bg-card/90 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Avatar className="h-16 w-16 shrink-0 border-2 border-primary/20 shadow-sm sm:h-20 sm:w-20">
                <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.display_name} />
                <AvatarFallback className="text-lg font-bold">{initials(profile.display_name)}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-extrabold">{profile.display_name}</h1>
                  <Badge variant="secondary" className="gap-1">
                    <GraduationCap className="h-3.5 w-3.5" /> Professor
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">@{profile.public_slug}</p>
                <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
                  {profile.public_bio || 'Materiais públicos de inglês para estudo e prática.'}
                </p>
                {specialties.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {specialties.slice(0, 3).map((specialty) => (
                      <Badge key={specialty} variant="outline" className="text-xs font-normal">{specialty}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 lg:w-72">
              <div className="rounded-lg border bg-background/60 px-3 py-2 text-center">
                <div className="text-lg font-bold">{folderCount}</div>
                <div className="text-[11px] text-muted-foreground">Pastas</div>
              </div>
              <div className="rounded-lg border bg-background/60 px-3 py-2 text-center">
                <div className="text-lg font-bold">{listCount}</div>
                <div className="text-[11px] text-muted-foreground">Listas</div>
              </div>
              <div className="rounded-lg border bg-background/60 px-3 py-2 text-center">
                <div className="text-lg font-bold">{cardCount}</div>
                <div className="text-[11px] text-muted-foreground">Cards</div>
              </div>
            </div>
          </div>
        </Card>

        {(turmasQuery.isLoading || turmasQuery.isError || turmas.length > 0) && (
          <section aria-labelledby="teacher-classes-title" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-primary">Comece por aqui</p>
                <h2 id="teacher-classes-title" className="text-2xl font-bold">Turmas públicas</h2>
              </div>
              <p className="text-sm text-muted-foreground">Entre e jogue sem criar conta.</p>
            </div>

            {turmasQuery.isLoading ? (
              <Card className="p-8 text-center text-muted-foreground">Carregando turmas...</Card>
            ) : turmasQuery.isError ? (
              <Card className="p-6 text-center">
                <School className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
                <h3 className="font-semibold">Não foi possível carregar as turmas públicas</h3>
                <Button variant="outline" className="mt-4" onClick={() => turmasQuery.refetch()}>Tentar novamente</Button>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {turmas.map((turma) => (
                  <Card key={turma.id} className="flex h-full flex-col gap-4 border-primary/20 p-4 transition-all hover:border-primary/50 hover:shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-bold">{turma.nome}</h3>
                        {turma.descricao && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{turma.descricao}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="shrink-0 gap-1">
                        <School className="h-3.5 w-3.5" /> Pública
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers3 className="h-4 w-4" /> {asNumber(turma.assignment_count)} atividades
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4" /> {asNumber(turma.card_count)} cards
                      </span>
                    </div>

                    <Button className="mt-auto w-full" onClick={() => navigate(`/turmas/${turma.id}`)}>
                      <Gamepad2 className="mr-2 h-4 w-4" /> Entrar e jogar
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        <section aria-labelledby="teacher-materials-title" className="space-y-3">
          <div>
            <p className="text-sm font-medium text-primary">Biblioteca pública</p>
            <h2 id="teacher-materials-title" className="text-2xl font-bold">Outros materiais</h2>
          </div>

          {foldersQuery.isLoading ? (
            <Card className="p-8 text-center text-muted-foreground">Carregando materiais...</Card>
          ) : foldersQuery.isError ? (
            <Card className="p-6 text-center">
              <BookOpen className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
              <h3 className="font-semibold">Não foi possível carregar os materiais</h3>
              <Button variant="outline" className="mt-4" onClick={() => foldersQuery.refetch()}>Tentar novamente</Button>
            </Card>
          ) : folders.length === 0 ? (
            <Card className="p-8 text-center">
              <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">Nenhum material público disponível</h3>
            </Card>
          ) : (
            <ApeGrid>
              {folders.map((folder) => (
                <ApeCardFolder
                  key={folder.id}
                  title={folder.title}
                  listCount={asNumber(folder.list_count)}
                  cardCount={asNumber(folder.card_count)}
                  onClick={() => navigate(`/portal/folder/${folder.id}`)}
                />
              ))}
            </ApeGrid>
          )}
        </section>

        <section className="flex flex-col items-center justify-between gap-4 border-t border-border/50 py-6 text-center sm:flex-row sm:text-left">
          <div>
            <h2 className="text-lg font-bold">Quer salvar seu progresso?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie uma conta apenas para sincronizar progresso, favoritos e histórico.
            </p>
          </div>
          <AuthAwareCTA size="default">Criar acesso</AuthAwareCTA>
        </section>
      </main>
    </div>
  );
}
