import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CreateFlashcardForm } from "@/components/CreateFlashcardForm";
import { FlashcardList } from "@/components/FlashcardList";
import { PracticeMode } from "@/components/PracticeMode";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { ArrowLeft, Play, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Flashcard {
  id: string;
  term: string;
  translation: string;
  audio_url?: string;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
}

const Collection = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [practiceMode, setPracticeMode] = useState<"write_pt_en" | "write_en_pt" | null>(null);
  const [profile, setProfile] = useState<{first_name?: string; email?: string} | null>(null);

  useEffect(() => {
    loadCollection();
    loadFlashcards();
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase
      .from("profiles")
      .select("first_name, email")
      .eq("id", user.id)
      .single();
    
    if (data) {
      setProfile(data);
    }
  };

  const loadCollection = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Erro ao carregar coleção");
      navigate("/");
      return;
    }

    setCollection(data);
  };

  const loadFlashcards = async () => {
    if (!id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("flashcards")
      .select("*")
      .eq("collection_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar flashcards");
    } else {
      setFlashcards(data || []);
    }
    setLoading(false);
  };

  const handleAddFlashcard = async (term: string, translation: string) => {
    if (!id) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Você precisa estar logado");
      return;
    }

    const { error } = await supabase.from("flashcards").insert({
      collection_id: id,
      user_id: user.id,
      term,
      translation,
    });

    if (error) {
      toast.error("Erro ao criar flashcard");
    } else {
      loadFlashcards();
    }
  };

  if (practiceMode) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <PracticeMode
          flashcards={flashcards}
          mode={practiceMode}
          onExit={() => setPracticeMode(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        {collection && (
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">{collection.name}</h1>
            {collection.description && (
              <p className="text-muted-foreground text-lg mb-2">{collection.description}</p>
            )}
            {profile && (
              <p className="text-lg text-muted-foreground">
                Olá, {profile.first_name?.split(' ')[0] || profile.email?.split('@')[0] || 'Aluno'}!
              </p>
            )}
          </div>
        )}

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Adicionar Flashcard</h2>
            <BulkImportDialog
              collectionId={id!}
              existingCards={flashcards.map(f => ({ front: f.term, back: f.translation }))}
              onImported={loadFlashcards}
            />
          </div>
          <CreateFlashcardForm onAdd={handleAddFlashcard} />
        </div>

        {flashcards.length > 0 && (
          <div className="mb-8 flex gap-4 flex-wrap">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setPracticeMode("write_pt_en")}
            >
              <Pencil className="mr-2 h-5 w-5" />
              Praticar: PT → EN
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setPracticeMode("write_en_pt")}
            >
              <Pencil className="mr-2 h-5 w-5" />
              Praticar: EN → PT
            </Button>
          </div>
        )}

        <div>
          <h2 className="text-2xl font-bold mb-4">
            Flashcards ({flashcards.length})
          </h2>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <FlashcardList flashcards={flashcards} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Collection;
