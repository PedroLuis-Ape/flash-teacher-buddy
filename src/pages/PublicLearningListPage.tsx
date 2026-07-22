import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Gamepad2, Layers3, UserRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { SEOHead } from "@/components/seo/SEOHead";
import {
  buildPublicLearningListStructuredData,
  publicLearningListDescription,
  type PublicLearningList,
  type PublicLearningListCard,
} from "@/components/seo/publicLearningListStructuredData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const PREVIEW_LIMIT = 24;

function asList(data: unknown): PublicLearningList | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  return row as PublicLearningList;
}

function asCards(data: unknown): PublicLearningListCard[] {
  return Array.isArray(data) ? data as PublicLearningListCard[] : [];
}

function isMissingRpc(error: unknown, functionName: string) {
  const candidate = error as { code?: string; message?: string; details?: string } | null;
  const text = `${candidate?.code ?? ""} ${candidate?.message ?? ""} ${candidate?.details ?? ""}`.toLowerCase();
  return text.includes("pgrst202") || text.includes("42883") || text.includes(functionName.toLowerCase());
}

async function loadLegacyPublicList(id: string): Promise<PublicLearningList | null> {
  const listResponse = await (supabase as any)
    .from("lists")
    .select("id, folder_id, title, description, study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (listResponse.error) throw listResponse.error;
  if (!listResponse.data) return null;

  const folderResponse = await (supabase.rpc as any)("get_portal_folder", {
    _id: listResponse.data.folder_id,
  });
  if (folderResponse.error) throw folderResponse.error;
  const folder = Array.isArray(folderResponse.data) ? folderResponse.data[0] : folderResponse.data;
  if (!folder) return null;

  return {
    ...listResponse.data,
    folder_title: folder.title || "Material publico",
    author_display_name: "Professor no APE",
    author_slug: null,
    author_avatar_url: null,
    card_count: 0,
  } as PublicLearningList;
}

async function loadLegacyPublicCards(id: string): Promise<PublicLearningListCard[]> {
  const response = await (supabase.rpc as any)("get_portal_flashcards", { _list_id: id });
  if (response.error) throw response.error;
  return asCards(response.data)
    .filter((card) => !(card as PublicLearningListCard & { parent_card_id?: string | null }).parent_card_id)
    .slice(0, PREVIEW_LIMIT);
}

function languageLabel(code?: string | null) {
  const labels: Record<string, string> = {
    en: "Inglês",
    pt: "Português",
    es: "Espanhol",
    fr: "Francês",
    de: "Alemão",
    it: "Italiano",
    ja: "Japonês",
    ko: "Coreano",
    zh: "Chinês",
  };
  return labels[code ?? ""] ?? (code?.toUpperCase() || "Idioma");
}

export default function PublicLearningListPage() {
  const { id = "" } = useParams();
  const query = useQuery({
    queryKey: ["public-learning-list-page", id],
    enabled: Boolean(id),
    retry: 1,
    queryFn: async () => {
      const listResponse = await (supabase as any).rpc("get_public_learning_list", { _id: id });
      const list = listResponse.error && isMissingRpc(listResponse.error, "get_public_learning_list")
        ? await loadLegacyPublicList(id)
        : asList(listResponse.data);
      if (listResponse.error && !isMissingRpc(listResponse.error, "get_public_learning_list")) {
        throw listResponse.error;
      }
      if (!list) return { list: null, cards: [] as PublicLearningListCard[] };

      const cardsResponse = await (supabase as any).rpc("get_public_learning_list_card_preview", {
        _list_id: id,
        _limit: PREVIEW_LIMIT,
      });
      const cards = cardsResponse.error && isMissingRpc(cardsResponse.error, "get_public_learning_list_card_preview")
        ? await loadLegacyPublicCards(id)
        : asCards(cardsResponse.data);
      if (cardsResponse.error && !isMissingRpc(cardsResponse.error, "get_public_learning_list_card_preview")) {
        throw cardsResponse.error;
      }

      return {
        list: { ...list, card_count: Number(list.card_count ?? cards.length) || cards.length },
        cards,
      };
    },
  });

  const list = query.data?.list ?? null;
  const cards = useMemo(() => query.data?.cards ?? [], [query.data?.cards]);
  const path = `/portal/list/${id}`;
  const description = list
    ? publicLearningListDescription(list)
    : "Lista pública de estudo no APE.";
  const jsonLd = useMemo(
    () => list ? buildPublicLearningListStructuredData(list, cards) : undefined,
    [list, cards],
  );

  if (query.isLoading) {
    return (
      <div className="min-h-screen bg-background grid place-items-center px-4">
        <p className="text-muted-foreground">Carregando lista pública...</p>
      </div>
    );
  }

  if (query.isError || !list) {
    return (
      <div className="min-h-screen bg-background text-foreground grid place-items-center px-4">
        <SEOHead
          title="Lista pública indisponível | APE"
          description="Esta lista não foi encontrada ou não está disponível publicamente."
          path={path}
          canonicalPath={null}
          robots="noindex,nofollow"
        />
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Lista pública indisponível</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>Esta lista pode ter sido removida, tornada privada ou ainda não estar publicada como fonte canônica.</p>
            <Button asChild variant="outline">
              <Link to="/portal"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao portal</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10 text-foreground">
      <SEOHead
        title={`${list.title} | Lista pública no APE`}
        description={description}
        path={path}
        image={list.author_avatar_url || undefined}
        imageAlt={`Lista pública ${list.title}`}
        jsonLd={jsonLd}
      />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <Link to={`/portal/folder/${list.folder_id}`} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" />
          Voltar para {list.folder_title || "o material"}
        </Link>

        <header className="mt-7 max-w-4xl">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">Lista educacional pública</p>
          <h1 className="mt-3 text-balance text-4xl font-black leading-tight sm:text-5xl">{list.title}</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">{description}</p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-2"><Layers3 className="h-4 w-4" />{Number(list.card_count ?? 0)} cards</span>
            <span>{languageLabel(list.lang_a)} + {languageLabel(list.lang_b)}</span>
            {list.author_slug ? (
              <Link to={`/portal/professor/${list.author_slug}`} className="inline-flex items-center gap-2 hover:text-primary">
                <UserRound className="h-4 w-4" />{list.author_display_name}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4" />{list.author_display_name}</span>
            )}
          </div>
        </header>

        <section className="mt-9 flex flex-wrap gap-3" aria-label="Modos de estudo">
          <Button asChild><Link to={`/portal/list/${list.id}/games`}><Gamepad2 className="mr-2 h-4 w-4" />Abrir atividades</Link></Button>
          <Button asChild variant="secondary"><Link to={`/portal/list/${list.id}/study`}><BookOpen className="mr-2 h-4 w-4" />Estudar flashcards</Link></Button>
          <Button asChild variant="outline"><Link to={`/portal/list/${list.id}/mixed-study`}>Modo misto</Link></Button>
        </section>

        <section className="mt-12" aria-labelledby="list-preview">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="list-preview" className="text-2xl font-black">Prévia dos cards</h2>
              <p className="mt-2 text-muted-foreground">A página mostra até {PREVIEW_LIMIT} cards principais. Camadas internas não inflam esta contagem.</p>
            </div>
          </div>

          {cards.length ? (
            <ol className="mt-6 grid gap-4 md:grid-cols-2">
              {cards.map((card, index) => (
                <li key={card.id}>
                  <Card className="h-full">
                    <CardContent className="p-5">
                      <p className="text-xs font-black uppercase tracking-wide text-primary">Card {index + 1}</p>
                      <p className="mt-3 text-lg font-extrabold">{card.term}</p>
                      <p className="mt-2 leading-7 text-muted-foreground">{card.translation}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          ) : (
            <Card className="mt-6"><CardContent className="p-6 text-muted-foreground">A lista está publicada, mas não possui cards principais disponíveis para prévia.</CardContent></Card>
          )}
        </section>

        <nav className="mt-12 flex flex-wrap gap-4 border-t border-border pt-7" aria-label="Navegação pública">
          <Link to={`/portal/folder/${list.folder_id}`} className="font-bold text-primary hover:underline">Ver pasta de origem</Link>
          {list.author_slug && <Link to={`/portal/professor/${list.author_slug}`} className="font-bold text-primary hover:underline">Ver professor</Link>}
          <Link to="/pt-br/metodologia" className="font-bold text-primary hover:underline">Entender a metodologia</Link>
        </nav>
      </main>
    </div>
  );
}
