import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, FolderOpen } from "lucide-react";
import { PitecoMascot } from "@/components/PitecoMascot";

interface Collection {
  id: string;
  name: string;
  description?: string;
}

export default function PublicPortal() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [flashcardCounts, setFlashcardCounts] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    loadPublicCollections();
  }, []);

  const loadPublicCollections = async () => {
    try {
      setLoading(true);

      // Find the teacher's public collections
      const { data: collectionsData, error: collectionsError } = await supabase
        .from("collections")
        .select("*")
        .in("visibility", ["public", "class"])
        .order("created_at", { ascending: false });

      if (collectionsError) throw collectionsError;

      setCollections(collectionsData || []);

      // Load flashcard counts
      if (collectionsData) {
        const counts: { [key: string]: number } = {};
        for (const collection of collectionsData) {
          const { count } = await supabase
            .from("flashcards")
            .select("*", { count: "exact", head: true })
            .eq("collection_id", collection.id);
          counts[collection.id] = count || 0;
        }
        setFlashcardCounts(counts);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-primary flex items-center justify-center">
        <div className="text-primary-foreground text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-primary">
      <PitecoMascot />
      
      <div className="container mx-auto px-4 py-8 relative z-20">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            className="text-primary-foreground hover:bg-white/20"
            onClick={() => navigate("/auth")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
              Portal do Aluno
            </h1>
            <p className="text-xl text-primary-foreground/90">
              Professor Pedro
            </p>
          </div>

          {collections.length === 0 ? (
            <Card className="bg-white/95 backdrop-blur">
              <CardContent className="py-12 text-center">
                <FolderOpen className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">
                  Ainda não há coleções disponíveis para estudo.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {collections.map((collection) => (
                <Card 
                  key={collection.id}
                  className="bg-white/95 backdrop-blur hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => navigate(`/portal/collection/${collection.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-2xl mb-2">{collection.name}</CardTitle>
                        {collection.description && (
                          <CardDescription className="text-base">
                            {collection.description}
                          </CardDescription>
                        )}
                      </div>
                      <BookOpen className="h-8 w-8 text-primary ml-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{flashcardCounts[collection.id] || 0} cartões</span>
                      <Button variant="secondary" size="sm">
                        Estudar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
