import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { PitecoMascot } from "@/features/gamification/components/PitecoMascot";

interface Collection {
  id: string;
  name: string;
  description?: string;
}

export default function PublicCollection() {
  const { id, collectionId } = useParams<{ id?: string; collectionId?: string }>();
  const resolvedCollectionId = id || collectionId || "";
  const navigate = useNavigate();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [flashcardCount, setFlashcardCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void loadCollection(controller.signal);
    return () => controller.abort();
    // The route id is the complete load identity; the callback is intentionally
    // recreated by this page and guarded by the AbortSignal above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedCollectionId]);

  const loadCollection = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setLoadError(false);
      if (!resolvedCollectionId) throw new Error("Missing public collection id");

      const { data, error } = await publicSupabase
        .from("collections")
        .select("*")
        .eq("id", resolvedCollectionId)
        .abortSignal(signal ?? new AbortController().signal)
        .single();

      if (error) throw error;

      setCollection(data);

      const { count, error: countError } = await publicSupabase
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .eq("collection_id", resolvedCollectionId)
        .is("deleted_at", null)
        .abortSignal(signal ?? new AbortController().signal);

      if (countError || count === null) throw countError ?? new Error("Unconfirmed card count");
      setFlashcardCount(count);
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Error loading collection:", error);
      setLoadError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const startGame = (mode: "flip" | "write" | "mixed") => {
    if (mode === "mixed") {
      navigate(
        `/portal/collection/${resolvedCollectionId}/mixed-study?mode=mixed&dir=any&order=random`
      );
      return;
    }

    navigate(
      `/portal/collection/${resolvedCollectionId}/study?mode=${mode}&direction=any&order=random`
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-primary flex items-center justify-center">
        <div className="text-primary-foreground text-xl">Carregando...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-lg p-8 text-center space-y-4">
          <CardTitle>Não foi possível confirmar esta coleção</CardTitle>
          <CardDescription>Os dados continuam preservados. Tente carregar novamente.</CardDescription>
          <Button onClick={() => void loadCollection()}>Tentar novamente</Button>
          <Button variant="ghost" onClick={() => navigate("/portal")}>Voltar ao Portal</Button>
        </Card>
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
