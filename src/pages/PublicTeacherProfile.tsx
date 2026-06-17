import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BookOpen, FolderOpen, GraduationCap, SearchX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ApeCardFolder } from '@/components/ape/ApeCardFolder';
import { ApeGrid } from '@/components/ape/ApeGrid';
import { AuthAwareCTA } from '@/components/auth/AuthAwareLink';
import { PublicPageHeader } from '@/components/seo/PublicPageHeader';
import { SEOHead } from '@/components/seo/SEOHead';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  buildPublicTurmaPath,
  PublicTeacherTurmasSection,
  PUBLIC_TEACHER_STATS_GRID_CLASS,
  type PublicTeacherTurmaRow,
} from '@/features/publicTeacher/components/PublicTeacherTurmasSection';
import {
  isMissingDirectoryRpc,
  shouldUsePreviewFallback,
} from '@/features/publicTeacher/lib/publicTeacherProfile';

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

const PREVIEW_PROFILE: PublicTeacherProfileRow = {
  display_name: 'Professor Pedro',
  avatar_url: null,
  public_slug: 'pedro',
  public_bio:
    'Materiais de inglês organizados para brasileiros, com foco em vocabulário, gramática, conversação e prática ativa.',
  public_specialties: ['Inglês para iniciantes', 'Conversação', 'Gramática'],
  folder_count: 0,
  list_count: 0,
  card_count: 0,
};

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
  const canUsePreviewFallback = import.meta.env.DEV;

  const profileQuery = useQuery({
    queryKey: ['public-teacher-profile', slug],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_public_teacher_profile', {
        _slug: slug,
      });

      if (error) {
        if (shouldUsePreviewFallback({
          error,
          slug,
          previewSlug: PREVIEW_PROFILE.public_slug,
          isDevelopment: canUsePreviewFallback,
        })) {
          return { profile: PREVIEW_PROFILE, previewMode: true };
        }
        if (isMissingDirectoryRpc(error)) {
          console.error('[PublicTeacherProfile] Public profile RPC is not deployed.', error);
        }
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      return { profile: (row ?? null) as PublicTeacherProfileRow | null, previewMode: false };
    },
    enabled: Boolean(slug),
    retry: false,
    staleTime: 60_000,
  });

  const foldersQuery = useQuery({
    queryKey: ['public-teacher-folders', slug],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_public_teacher_folders', {
        _slug: slug,
      });

      if (error) {
        if (profileQuery.data?.previewMode && canUsePreviewFallback && isMissingDirectoryRpc(error)) {
          return [] as PublicTeacherFolderRow[];
        }
        if (isMissingDirectoryRpc(error)) {
          console.error('[PublicTeacherProfile] Public folders RPC is not deployed.', error);
        }
        throw error;
      }

      return (data ?? []) as PublicTeacherFolderRow[];
    },
    enabled: Boolean(slug && profileQuery.data?.profile),
    retry: false,
    staleTime: 60_000,
  });

  const turmasQuery = useQuery({
    queryKey: ['public-teacher-turmas', slug],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_public_teacher_turmas', {
        _slug: slug,
      });

      if (error) {
        if (profileQuery.data?.previewMode && canUsePreviewFallback && isMissingDirectoryRpc(error)) {
          return [] as PublicTeacherTurmaRow[];
        }
        if (isMissingDirectoryRpc(error)) {
          console.error('[PublicTeacherProfile] Public classrooms RPC is not deployed.', error);
        }
        throw error;
      }

      return (data ?? []) as PublicTeacherTurmaRow[];
    },
    enabled: Boolean(slug && profileQuery.data?.profile),
    retry: false,
    staleTime: 60_000,
  });

  const profile = profileQuery.data?.profile ?? null;
  const previewMode = profileQuery.data?.previewMode ?? false;
  const specialties = useMemo(() => profile?.public_specialties?.filter(Boolean) ?? [], [profile]);
  const folders = foldersQuery.data ?? [];
  const turmas = turmasQuery.data ?? [];

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicPageHeader title="Perfil público" fallbackPath="/portal" />
        <div className="mx-auto flex min-h-[50vh] max-w-6xl items-center justify-center px-4 text-muted-foreground">
          Carregando perfil do professor...
        </div>
      </div>
    );
  }

  if (profileQuery.isError && isMissingDirectoryRpc(profileQuery.error) && !canUsePreviewFallback) {
    return (
      <div className="min-h-screen bg-background">
        <PublicPageHeader title="Perfil público" fallbackPath="/portal" />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <Card className="p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h1 className="text-xl font-bold">O perfil público ainda não foi completamente implantado</h1>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              A configuração do diretório público precisa ser atualizada. Nenhum dado demonstrativo foi exibido no lugar dos dados reais.
            </p>
            <Button className="mt-6" onClick={() => profileQuery.refetch()}>
              Tentar novamente
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <PublicPageHeader title="Perfil público" fallbackPath="/portal" />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <Card className="p-8 text-center">
            <SearchX className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h1 className="text-xl font-bold">Professor não encontrado</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Este perfil não existe, deixou de ser público ou ainda não foi publicado.
            </p>
            <Button className="mt-6" onClick={() => navigate('/portal')}>
              Voltar ao portal
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  const folderCount = asNumber(profile.folder_count);
  const listCount = asNumber(profile.list_count);
  const cardCount = asNumber(profile.card_count);
  const turmaCount = turmasQuery.isLoading || turmasQuery.isError ? '—' : turmas.length;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${profile.display_name} | Materiais públicos de inglês`}
        description={
          profile.public_bio ||
          `Explore materiais públicos de inglês compartilhados por ${profile.display_name}.`
        }
        path={`/portal/professor/${profile.public_slug}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: profile.display_name,
          description: profile.public_bio || undefined,
          url: `https://www.apeeducation.org/portal/professor/${profile.public_slug}`,
        }}
      />

      <PublicPageHeader title="Perfil do professor" fallbackPath="/portal" />

      <main className="container mx-auto max-w-6xl space-y-10 px-4 pb-24 pt-8 sm:px-6">
        <Card className="overflow-hidden border-primary/20 bg-card/85 shadow-sm backdrop-blur">
          <div className="h-24 bg-gradient-to-r from-primary/25 via-primary-glow/15 to-transparent" />
          <div className="px-5 pb-6 sm:px-8 sm:pb-8">
            <div className="-mt-10 flex flex-col gap-5 sm:flex-row sm:items-end">
              <Avatar className="h-20 w-20 border-4 border-background shadow-md sm:h-24 sm:w-24">
                <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.display_name} />
                <AvatarFallback className="text-xl font-bold">
                  {initials(profile.display_name)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <Badge variant="secondary" className="mb-2 gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Perfil público de professor
                </Badge>
                <h1 className="text-2xl font-extrabold sm:text-3xl">{profile.display_name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">@{profile.public_slug}</p>
              </div>
            </div>

            <p className="mt-6 max-w-3xl leading-relaxed text-muted-foreground">
              {profile.public_bio ||
                'Este professor compartilha materiais públicos de inglês para estudo e prática.'}
            </p>

            {specialties.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {specialties.map((specialty) => (
                  <Badge key={specialty} variant="outline" className="font-normal">
                    {specialty}
                  </Badge>
                ))}
              </div>
            )}

            <div className={PUBLIC_TEACHER_STATS_GRID_CLASS}>
              <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-center">
                <div className="text-xl font-bold">{turmaCount}</div>
                <div className="text-xs text-muted-foreground">Turmas</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-center">
                <div className="text-xl font-bold">{folderCount}</div>
                <div className="text-xs text-muted-foreground">Pastas</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-center">
                <div className="text-xl font-bold">{listCount}</div>
                <div className="text-xs text-muted-foreground">Listas</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-center">
                <div className="text-xl font-bold">{cardCount}</div>
                <div className="text-xs text-muted-foreground">Cards</div>
              </div>
            </div>

            {previewMode && (
              <p className="mt-5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                Ambiente de desenvolvimento: este perfil usa dados demonstrativos porque as RPCs do diretório público não estão disponíveis localmente.
              </p>
            )}
          </div>
        </Card>

        <PublicTeacherTurmasSection
          profileName={profile.display_name}
          turmas={turmas}
          isLoading={turmasQuery.isLoading}
          isError={turmasQuery.isError}
          onRetry={() => turmasQuery.refetch()}
          onOpenTurma={(turmaId) => navigate(buildPublicTurmaPath(turmaId))}
        />

        <section aria-labelledby="teacher-materials-title" className="space-y-5">
          <div>
            <p className="text-sm font-medium text-primary">Biblioteca pública</p>
            <h2 id="teacher-materials-title" className="text-2xl font-bold">
              Materiais de {profile.display_name}
            </h2>
          </div>

          {foldersQuery.isLoading ? (
            <Card className="p-10 text-center text-muted-foreground">Carregando materiais...</Card>
          ) : foldersQuery.isError ? (
            <Card className="p-8 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">Não foi possível carregar os materiais</h3>
              <Button variant="outline" className="mt-5" onClick={() => foldersQuery.refetch()}>
                Tentar novamente
              </Button>
            </Card>
          ) : folders.length === 0 ? (
            <Card className="p-10 text-center">
              <FolderOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="font-semibold">Nenhum material público disponível</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {previewMode
                  ? 'O preview local não possui pastas demonstrativas.'
                  : 'Este professor ainda não publicou pastas para visitantes.'}
              </p>
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

        <section className="border-t border-border/50 py-10 text-center">
          <h2 className="text-2xl font-bold">Quer salvar progresso e criar seus materiais?</h2>
          <p className="mx-auto mb-6 mt-2 max-w-xl text-muted-foreground">
            Crie uma conta gratuita para usar listas personalizadas, jogos e atividades interativas.
          </p>
          <AuthAwareCTA size="lg">Criar acesso</AuthAwareCTA>
        </section>
      </main>
    </div>
  );
}
