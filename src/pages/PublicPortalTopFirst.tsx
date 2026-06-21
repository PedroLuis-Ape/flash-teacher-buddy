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

      <main className="container mx-auto max-w-6xl px-4 pb-12 pt-2 sm:px-6 sm:pb-20 sm:pt-3">
        <section className="mx-auto max-w-3xl pb-4 pt-1 text-center sm:py-6">
          <Badge variant="secondary" className="mb-2 gap-1.5 px-2 py-0.5 text-[10px] sm:text-xs">
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Professores e materiais públicos
          </Badge>
          <h1 className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-[1.65rem] font-extrabold leading-tight text-transparent sm:text-4xl">
            Encontre um professor
          </h1>
          <p className="mx-auto mt-1.5 max-w-2xl text-xs text-muted-foreground sm:mt-2 sm:text-base">
            Pesquise e entre direto nos materiais públicos.
          </p>

          <div className="relative mx-auto mt-4 max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground sm:h-5 sm:w-5" />
            <Input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Professor, username ou especialidade"
              aria-label="Pesquisar professor"
              className="h-10 rounded-xl border-primary/30 bg-card/90 pl-10 text-sm shadow-sm backdrop-blur sm:h-11 sm:pl-11 sm:text-base"
              autoComplete="off"
            />
          </div>
        </section>

        <section aria-labelledby="recommended-teachers-title" className="space-y-3 sm:space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-primary sm:text-sm">{debouncedSearch ? 'Pesquisa' : 'Comece por aqui'}</p>
              <h2 id="recommended-teachers-title" className="text-xl font-bold sm:text-2xl">
                {debouncedSearch ? `Resultados para “${debouncedSearch}”` : 'Professores recomendados'}
              </h2>
            </div>
            <p className="hidden max-w-xl text-xs text-muted-foreground sm:block sm:text-right">
              Escolha um professor para acessar turmas, atividades e jogos públicos.
            </p>
          </div>

          {teachersQuery.isLoading || isSearching ? (
            <Card className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6 sm:py-10">Pesquisando professores...</Card>
          ) : teachersQuery.isError ? (
            <Card className="px-4 py-8 text-center sm:px-6 sm:py-10">
              <UserRound className="mx-auto mb-2 h-8 w-8 text-muted-foreground sm:h-10 sm:w-10" />
              <h3 className="font-semibold">Não foi possível pesquisar agora</h3>
              <p className="mx-auto mt-1.5 max-w-md text-xs text-muted-foreground sm:text-sm">
                Houve um problema ao carregar o diretório público. Tente novamente.
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => teachersQuery.refetch()}>
                Tentar novamente
              </Button>
            </Card>
          ) : teachers.length === 0 ? (
            <Card className="px-4 py-8 text-center sm:px-6 sm:py-10">
              <UserRound className="mx-auto mb-2 h-8 w-8 text-muted-foreground sm:h-10 sm:w-10" />
              <h3 className="font-semibold">Nenhum professor encontrado</h3>
              <p className="mx-auto mt-1.5 max-w-md text-xs text-muted-foreground sm:text-sm">
                Não encontramos esse nome, username ou especialidade entre os perfis públicos.
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setSearchTerm('')}>
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
                  <Card key={teacher.public_slug} className="flex h-full flex-col gap-3 border-primary/20 bg-card/90 p-3 shadow-sm backdrop-blur transition-all hover:border-primary/50 hover:shadow-lg sm:gap-4 sm:p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 shrink-0 ring-1 ring-primary/20 sm:h-14 sm:w-14">
                        <AvatarImage src={teacher.avatar_url ?? undefined} alt={teacher.display_name} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/25 to-primary-glow/20 font-bold text-primary">
                          {initials(teacher.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px] sm:text-xs">
                            <GraduationCap className="h-3 w-3" /> Professor público
                          </Badge>
                          {teacher.preview_mode && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Demonstração</Badge>}
                        </div>
                        <h3 className="truncate text-base font-bold sm:text-lg">{teacher.display_name}</h3>
                        <p className="text-[11px] text-muted-foreground sm:text-xs">@{teacher.public_slug}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:line-clamp-2 sm:text-sm">
                          {teacher.public_bio || 'Este professor compartilha materiais públicos de inglês.'}
                        </p>
                      </div>
                    </div>

                    {specialties.length > 0 && (
                      <div className="hidden flex-wrap gap-1.5 sm:flex">
                        {specialties.slice(0, 3).map((specialty) => (
                          <Badge key={specialty} variant="outline" className="text-xs font-normal">{specialty}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground sm:hidden">
                      <span><strong className="text-foreground">{folderCount}</strong> pastas</span>
                      <span aria-hidden="true">·</span>
                      <span><strong className="text-foreground">{listCount}</strong> listas</span>
                      <span aria-hidden="true">·</span>
                      <span><strong className="text-foreground">{cardCount}</strong> cards</span>
                    </div>

                    <div className="hidden grid-cols-3 gap-2 text-center text-sm sm:grid">
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

                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-2.5 sm:pt-3">
                      <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                        <BookOpen className="h-4 w-4" /> Materiais e jogos públicos
                      </span>
                      <Button asChild type="button" size="sm" className="ml-auto h-9 gap-1.5 px-4">
                        <Link to={`/portal/professor/${teacher.public_slug}`}>
                          Ver perfil <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-7 sm:mt-10">
          <GuestContinueSection />
        </section>

        <section className="mt-10 hidden border-t border-border/50 py-8 text-center sm:block">
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
