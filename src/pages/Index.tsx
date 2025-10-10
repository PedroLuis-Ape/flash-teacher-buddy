import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CollectionCard } from "@/components/CollectionCard";
import { CreateCollectionDialog } from "@/components/CreateCollectionDialog";
import { GraduationCap, LogOut } from "lucide-react";
import { toast } from "sonner";
import heroImage from "@/assets/hero-bg.jpg";

interface Collection {
  id: string;
  name: string;
  description?: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [flashcardCounts, setFlashcardCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadCollections();
    }
  }, [user]);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/auth");
      } else if (session) {
        setUser(session.user);
      }
    });
  };

  const loadCollections = async () => {
    setLoading(true);

    const { data: collectionsData, error } = await supabase
      .from("collections")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar coleções");
    } else {
      setCollections(collectionsData || []);

      // Load flashcard counts for each collection
      const counts: Record<string, number> = {};
      for (const collection of collectionsData || []) {
        const { count } = await supabase
          .from("flashcards")
          .select("*", { count: "exact", head: true })
          .eq("collection_id", collection.id);

        counts[collection.id] = count || 0;
      }
      setFlashcardCounts(counts);
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado!");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section
        className="relative bg-gradient-to-br from-primary via-primary-glow to-accent text-primary-foreground overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(135deg, hsl(250 70% 60% / 0.95), hsl(260 80% 70% / 0.95)), url(${heroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-10 w-10" />
              <h1 className="text-3xl font-bold">APE - Apprenticeship Practice and Enhancement</h1>
            </div>
            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>

          <div className="max-w-2xl">
            <p className="text-lg mb-6 opacity-95">
              Organize seus flashcards em coleções e pratique com diferentes modos de estudo!
            </p>
            <CreateCollectionDialog onCollectionCreated={loadCollections} />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none"></div>
      </section>

      {/* Collections Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {loading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : collections.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg mb-4">
                Você ainda não tem coleções. Crie sua primeira!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.map((collection) => (
                <CollectionCard
                  key={collection.id}
                  id={collection.id}
                  name={collection.name}
                  description={collection.description}
                  flashcardCount={flashcardCounts[collection.id] || 0}
                  onSelect={() => navigate(`/collection/${collection.id}`)}
                  onDelete={loadCollections}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Index;
