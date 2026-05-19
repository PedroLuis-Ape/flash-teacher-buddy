import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeCardFolder } from "@/components/ape/ApeCardFolder";
import { ApeGrid } from "@/components/ape/ApeGrid";
import { ApeSectionTitle } from "@/components/ape/ApeSectionTitle";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthAwareCTA } from "@/components/auth/AuthAwareLink";
import { SEOHead } from "@/components/seo/SEOHead";
import { PublicBackBar } from "@/components/seo/PublicBackBar";

interface FolderType {
  id: string;
  title: string;
  description: string | null;
  list_count?: number;
  card_count?: number;
}

const PublicPortal = () => {
  const navigate = useNavigate();
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      const { data, error } = await supabase.rpc('get_portal_folders');

      if (error) throw error;

      // Defesa extra: mesmo que get_portal_folders já filtre, garantimos que
      // nenhuma pasta de atribuição (vinculada a turma ou com prefixo
      // "[Atribuição]") apareça no Portal Público.
      const publicOnly = (data || []).filter((folder: any) => {
        if (folder?.class_id) return false;
        const title: string = folder?.title || "";
        if (title.trim().toLowerCase().startsWith("[atribuição]")) return false;
        if (title.trim().toLowerCase().startsWith("[atribuicao]")) return false;
        return true;
      });

      // Load counts for each folder
      const foldersWithCounts = await Promise.all(
        publicOnly.map(async (folder: any) => {
          const { data: countsData } = await supabase.rpc('get_portal_counts', {
            _folder_id: folder.id
          });

          const counts = countsData as any;

          return {
            ...folder,
            list_count: counts?.list_count || 0,
            card_count: counts?.card_count || 0,
          };
        })
      );

      setFolders(foldersWithCounts);
    } catch (error) {
      console.error("Error loading folders:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Portal Público de Atividades de Inglês | APE"
        description="Explore materiais públicos de inglês com flashcards, vocabulário, frases e atividades para praticar de forma ativa."
        path="/portal"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Portal Público de Atividades de Inglês — APE",
          inLanguage: "pt-BR",
          url: "https://www.apeeducation.org/portal",
        }}
      />
      <ApeAppBar title="Portal do Aluno" variant="home" />
      <PublicBackBar showPortal={false} />

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Hero */}
        <section className="text-center py-8 md:py-12">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-glow">
            Portal Público de Atividades de Inglês
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base md:text-lg">
            Explore materiais compartilhados para praticar vocabulário, frases, gramática e flashcards de inglês.
          </p>
        </section>

        <p className="text-sm text-muted-foreground max-w-3xl mx-auto text-center mb-8">
          Estes materiais podem incluir listas de estudo, flashcards, exercícios de tradução, prática de
          escrita e atividades criadas para alunos iniciantes e em desenvolvimento.
        </p>

        <ApeSectionTitle>
          Conteúdo Compartilhado
        </ApeSectionTitle>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Carregando...
          </div>
        ) : folders.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-foreground font-medium">
              Nenhum material público disponível no momento.
            </p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Novas atividades de inglês, listas de vocabulário e flashcards poderão aparecer aqui quando forem compartilhados.
            </p>
          </div>
        ) : (
          <ApeGrid>
            {folders.map((folder) => (
              <ApeCardFolder
                key={folder.id}
                title={folder.title}
                listCount={folder.list_count}
                cardCount={folder.card_count}
                onClick={() => navigate(`/portal/folder/${folder.id}`)}
              />
            ))}
          </ApeGrid>
        )}

        {/* Final CTA */}
        <section className="text-center mt-16 py-12 border-t border-border/50">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Quer praticar com seus próprios materiais?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Crie uma conta para estudar com listas personalizadas, jogos de flashcards e atividades interativas.
          </p>
          <AuthAwareCTA size="lg">Criar acesso</AuthAwareCTA>
        </section>
      </div>
    </div>
  );
};

export default PublicPortal;
