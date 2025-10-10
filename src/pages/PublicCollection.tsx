import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { PitecoMascot } from "@/components/PitecoMascot";

interface Collection {
  id: string;
  name: string;
  description?: string;
}

export default function PublicCollection() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [flashcardCount, setFlashcardCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCollection();
  }, [collectionId]);

  const loadCollection = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .eq("id", collectionId)
        .single();

      if (error) throw error;

      setCollection(data);

      const { count } = await supabase
        .from("flashcards")
        .select("*", { count: "exact", head: true })
        .eq("collection_id", collectionId!);

      setFlashcardCount(count || 0);
    } catch (error) {
      console.error("Error loading collection:", error);
      navigate("/portal");
    } finally {
      setLoading(false);
    }
  };

  const startGame = (mode: "flip" | "write" | "mixed") => {
    navigate(
      `/portal/collection/${collectionId}/study?mode=${mode}&direction=any&order=random`
    );
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
            onClick={() => navigate("/portal")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
              {collection?.name}
            </h1>
            {collection?.description && (
              <p className="text-xl text-primary-foreground/90">{collection.description}</p>
            )}
            <p className="text-lg text-primary-foreground/80 mt-2">{flashcardCount} cartões</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card 
              className="bg-white/95 backdrop-blur hover:shadow-xl transition-all cursor-pointer"
              onClick={() => startGame("flip")}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="h-6 w-6" />
                  Virar Cartas
                </CardTitle>
                <CardDescription>
                  Pratique virando as cartas e testando sua memória
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="default">
                  Jogar
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="bg-white/95 backdrop-blur hover:shadow-xl transition-all cursor-pointer"
              onClick={() => startGame("write")}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="h-6 w-6" />
                  Praticar Escrita
                </CardTitle>
                <CardDescription>
                  Escreva as respostas e melhore sua ortografia
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="default">
                  Jogar
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="bg-white/95 backdrop-blur hover:shadow-xl transition-all cursor-pointer"
              onClick={() => startGame("mixed")}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="h-6 w-6" />
                  Estudar (Misto)
                </CardTitle>
                <CardDescription>
                  Alterne entre virar cartas e escrever respostas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="default">
                  Jogar
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
