import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, GraduationCap, Search, Sparkles, UserRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AuthAwareCTA } from '@/components/auth/AuthAwareLink';
import { GuestContinueSection } from '@/components/portal/GuestContinueSection';
import { PublicPageHeader } from '@/components/seo/PublicPageHeader';
import { SEOHead } from '@/components/seo/SEOHead';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface PublicTeacherRow {
  display_name: string;
  avatar_url: string | null;
  public_slug: string;
  public_bio: string | null;
  public_specialties: string[] | null;
  folder_count: number | string;
  list_count: number | string;
  card_count: number | string;
  preview_mode?: boolean;
}

const PREVIEW_TEACHER: PublicTeacherRow = {
  display_name: 'Professor Pedro',
  avatar_url: null,
  public_slug: 'pedro',
  public_bio: 'Materiais de inglês organizados para brasileiros, com foco em vocabulário, gramática, conversação e prática ativa.',
  public_specialties: ['Inglês para iniciantes', 'Conversação', 'Gramática'],
  folder_count: 0,
  list_count: 0,
  card_count: 0,
  preview_mode: true,
};

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function isMissingDirectoryRpc(error: unknown) {
  const value = error as { code?: string; message?: string; details?: string } | null;
  const text = `${value?.message ?? ''} ${value?.details ?? ''}`.toLowerCase();
  return value?.code === 'PGRST202' || value?.code === '42883' || text.includes('search_public_teachers');
}

function asNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'P';
}

export default function PublicPortalTopFirst() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const teachersQuery = useQuery({
    queryKey: ['public-teacher-directory', debouncedSearch],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('search_public_teachers', {
        _q: debouncedSearch,
        _limit: 12,
      });

      if (error) {
        if (isMissingDirectoryRpc(error)) {
          const haystack = normalizeSearch([
            PREVIEW_TEACHER.display_name,
            PREVIEW_TEACHER.public_bio ?? '',
            ...(PREVIEW_TEACHER.public_specialties ?? []),
          ].join(' '));
          const query = normalizeSearch(debouncedSearch);
          return query && !haystack.includes(query) ? [] : [PREVIEW_TEACHER];
        }
        throw error;
      }

      return (data ?? []) as PublicTeacherRow[];
    },
    retry: false,
    staleTime: 60_000,
  });

  const teachers = teachersQuery.data ?? [];
  const isSearching = searchTerm.trim() !== debouncedSearch;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Encontre professores de inglês | Portal Público APE"
        description="Pesquise professores de inglês e acesse materiais públicos organizados dentro do perfil de cada professor."
        path="/portal"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Portal Público de Professores de Inglês — APE',
          inLanguage: 'pt-BR',
          url: 'https://www.apeeducation.org/portal',
        }}
      />

      <PublicPageHeader title="Portal público" fallbackPath="/" />

      <main className="container mx-auto max-w-6xl px-4 pb-20 pt-3 sm:px-6">
        <section className="mx-auto max-w-3xl py-4 text-center md:py-6">
          <Badge variant="secondary" className="mb-2 gap-2">
            <Sparkles className="h-3.5 w-3.5" /> Professores e materiais públicos
          </Badge>
          <h1 className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-2xl font-extrabold text-transparent md:text-4xl">
            Encontre um professor e comece a jogar
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            Pesquise por nome ou especialidade e entre diretamente nos materiais públicos.
          </p>
        </section>

        <section aria-labelledby="teacher-search-title" className="mx-auto mb-6 max-w-3xl">
          <Card className="border-primary/30 bg-card/90 p-4 shadow-sm backdrop-blur">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Search className="h-4 w-4" />
              </div>
              <div>
                <h2 id="teacher-search-title" className="font-semibold">Pesquisar professor</h2>
                <p id="teacher-search-help" className="text-xs text-muted-foreground">
                  Digite um nome, username ou área de ensino.
                </p>
              </div>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Ex.: Professor Pedro, conversação, iniciantes..."
                aria-describedby="teacher-search-help"
                className="h-11 pl-11 text-base"
                autoComplete="off"
              />
            </div>
          </Card>
        </section>

        <section aria-labelledby="recommended-teachers-title" className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">{debouncedSearch ? 'Pesquisa' : 'Comece por aqui'}</p>
              <h2 id="recommended-teachers-title" className="text-2xl font-bold">
                {debouncedSearch ? `Resultados para “${debouncedSearch}”` : 'Professores recomendados'}
              </h2>
            </div>
            <p className="max-w-xl text-xs text-muted-foreground sm:text-right">
              Escolha um professor para acessar turmas, atividades e jogos públicos.
            </p>
          </div>

          {teachersQuery.isLoading || isSearching ? (
            <Card className="px-6 py-10 text-center text-muted-foreground">Pesquisando professores...</Card>
          ) : teachersQuery.isError ? (
            <Card className="px-6 py-10 text-center">
              <UserRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">Não foi possível pesquisar agora</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Houve um problema ao carregar o diretório público. Tente novamente.
              </p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => teachersQuery.refetch()}>
                Tentar novamente
              </Button>
            </Card>
          ) : teachers.length === 0 ? (
            <Card className="px-6 py-10 text-center">
              <UserRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">Nenhum professor encontrado</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Não encontramos esse nome, username ou especialidade entre os perfis públicos.
              </p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => setSearchTerm('')}>
                Limpar pesquisa
              </Button>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {teachers.map((teacher) => {
                const folderCount = asNumber(teacher.folder_count);
                const listCount = asNumber(teacher.list_count);
                const cardCount = asNumber(teacher.card_count);
                const specialties = teacher.public_specialties?.filter(Boolean) ?? [];

                return (
                  <Card key={teacher.public_slug} className="flex h-full flex-col gap-4 border-primary/20 bg-card/90 p-4 shadow-sm backdrop-blur transition-all hover:border-primary/50 hover:shadow-lg">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 shrink-0 ring-1 ring-primary/20">
                        <AvatarImage src={teacher.avatar_url ?? undefined} alt={teacher.display_name} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/25 to-primary-glow/20 font-bold text-primary">
                          {initials(teacher.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <GraduationCap className="h-3 w-3" /> Professor público
                          </Badge>
                          {teacher.preview_mode && <Badge variant="outline">Demonstração</Badge>}
                        </div>
                        <h3 className="text-lg font-bold">{teacher.display_name}</h3>
                        <p className="text-xs text-muted-foreground">@{teacher.public_slug}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {teacher.public_bio || 'Este professor compartilha materiais públicos de inglês.'}
                        </p>
                      </div>
                    </div>

                    {specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {specialties.slice(0, 3).map((specialty) => (
                          <Badge key={specialty} variant="outline" className="text-xs font-normal">{specialty}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-lg border border-border/60 bg-background/50 p-2">
                        <div className="font-semibold">{folderCount}</div>
                        <div className="text-xs text-muted-foreground">Pastas</div>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/50 p-2">
                        <div className="font-semibold">{listCount}</div>
                        <div className="text-xs text-muted-foreground">Listas</div>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/50 p-2">
                        <div className="font-semibold">{cardCount}</div>
                        <div className="text-xs text-muted-foreground">Cards</div>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <BookOpen className="h-4 w-4" /> Materiais e jogos públicos
                      </span>
                      <Button asChild type="button" className="gap-2">
                        <Link to={`/portal/professor/${teacher.public_slug}`}>
                          Ver professor <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-10">
          <GuestContinueSection />
        </section>

        <section className="mt-10 border-t border-border/50 py-8 text-center">
          <h2 className="mb-2 text-xl font-bold md:text-2xl">Quer praticar com seus próprios materiais?</h2>
          <p className="mx-auto mb-5 max-w-xl text-sm text-muted-foreground">
            Crie uma conta para estudar com listas personalizadas, jogos de flashcards e atividades interativas.
          </p>
          <AuthAwareCTA size="lg">Criar acesso</AuthAwareCTA>
        </section>
      </main>
    </div>
  );
}
