import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, GraduationCap, Search, Sparkles, UserRound } from 'lucide-react';
import { AuthAwareCTA } from '@/components/auth/AuthAwareLink';
import { PublicPageHeader } from '@/components/seo/PublicPageHeader';
import { SEOHead } from '@/components/seo/SEOHead';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface RecommendedTeacher {
  id: string;
  name: string;
  initials: string;
  description: string;
  specialties: string[];
  materialLabel: string;
}

const RECOMMENDED_TEACHERS: RecommendedTeacher[] = [
  {
    id: 'professor-pedro',
    name: 'Professor Pedro',
    initials: 'PP',
    description:
      'Materiais de inglês organizados para brasileiros, com foco em vocabulário, gramática, conversação e prática ativa.',
    specialties: ['Inglês para iniciantes', 'Conversação', 'Gramática'],
    materialLabel: 'Perfil público em preparação',
  },
];

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const PublicPortal = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const visibleTeachers = useMemo(() => {
    const query = normalizeSearch(searchTerm);
    if (!query) return RECOMMENDED_TEACHERS;

    return RECOMMENDED_TEACHERS.filter((teacher) => {
      const searchableText = normalizeSearch(
        [teacher.name, teacher.description, ...teacher.specialties].join(' '),
      );
      return searchableText.includes(query);
    });
  }, [searchTerm]);

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

      <main className="container mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
        <section className="mx-auto max-w-3xl py-8 text-center md:py-12">
          <Badge variant="secondary" className="mb-4 gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Descubra professores e materiais
          </Badge>
          <h2 className="mb-4 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-3xl font-extrabold text-transparent md:text-5xl">
            Encontre um professor de inglês
          </h2>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
            Pesquise por nome ou especialidade. Os materiais públicos ficarão organizados dentro do perfil de cada professor.
          </p>
        </section>

        <section aria-labelledby="teacher-search-title" className="mx-auto mb-12 max-w-3xl">
          <Card className="border-primary/20 bg-card/80 p-4 shadow-sm backdrop-blur sm:p-6">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <h3 id="teacher-search-title" className="font-semibold">
                  Pesquisar professor
                </h3>
                <p id="teacher-search-help" className="text-sm text-muted-foreground">
                  Digite um nome, nível ou área de ensino.
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
                className="h-12 pl-11 text-base"
                autoComplete="off"
              />
            </div>
          </Card>
        </section>

        <section aria-labelledby="recommended-teachers-title" className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Descoberta</p>
              <h3 id="recommended-teachers-title" className="text-2xl font-bold">
                Professores recomendados
              </h3>
            </div>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-right">
              Novos professores e perfis públicos serão adicionados gradualmente.
            </p>
          </div>

          {visibleTeachers.length === 0 ? (
            <Card className="px-6 py-12 text-center">
              <UserRound className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h4 className="font-semibold">Nenhum professor encontrado</h4>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Não encontramos esse nome ou especialidade entre os professores recomendados desta seleção.
              </p>
              <Button type="button" variant="outline" className="mt-5" onClick={() => setSearchTerm('')}>
                Limpar pesquisa
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleTeachers.map((teacher) => (
                <Card
                  key={teacher.id}
                  className="flex h-full flex-col gap-5 border-border/70 bg-card/85 p-5 shadow-sm backdrop-blur transition-shadow hover:shadow-md sm:p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-primary-glow/20 text-lg font-bold text-primary ring-1 ring-primary/20">
                      {teacher.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Badge variant="secondary" className="mb-2 gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5" />
                        Professor recomendado
                      </Badge>
                      <h4 className="text-xl font-bold">{teacher.name}</h4>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {teacher.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {teacher.specialties.map((specialty) => (
                      <Badge key={specialty} variant="outline" className="font-normal">
                        {specialty}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-auto flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BookOpen className="h-4 w-4" />
                      {teacher.materialLabel}
                    </span>
                    <Button type="button" variant="outline" disabled className="gap-2">
                      Ver perfil
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="mt-16 border-t border-border/50 py-12 text-center">
          <h3 className="mb-3 text-2xl font-bold md:text-3xl">
            Quer praticar com seus próprios materiais?
          </h3>
          <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
            Crie uma conta para estudar com listas personalizadas, jogos de flashcards e atividades interativas.
          </p>
          <AuthAwareCTA size="lg">Criar acesso</AuthAwareCTA>
        </section>
      </main>
    </div>
  );
};

export default PublicPortal;
