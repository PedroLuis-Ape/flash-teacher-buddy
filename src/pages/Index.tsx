import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CollectionCard } from "@/components/CollectionCard";
import { CreateCollectionDialog } from "@/components/CreateCollectionDialog";
import { LogOut, Share2, Copy, Check } from "lucide-react";
import { PitecoLogo } from "@/components/PitecoLogo";
import { toast } from "sonner";
import heroImage from "@/assets/hero-bg.jpg";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Collection {
  id: string;
  name: string;
  description?: string;
  visibility?: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [flashcardCounts, setFlashcardCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState<{first_name?: string; email?: string; public_slug?: string; public_access_enabled?: boolean} | null>(null);
  const [publicSlug, setPublicSlug] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadCollections();
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("profiles")
      .select("first_name, email, public_slug, public_access_enabled")
      .eq("id", user.id)
      .single();
    
    if (data) {
      setProfile(data);
      setPublicSlug(data.public_slug || "");
    }
  };

  const generatePublicLink = async () => {
    if (!user || !publicSlug.trim()) {
      toast.error("Digite um nome para o link");
      return;
    }

    const slug = publicSlug.trim().toLowerCase().replace(/\s+/g, '-');

    const { error } = await supabase
      .from("profiles")
      .update({ 
        public_slug: slug,
        public_access_enabled: true 
      })
      .eq("id", user.id);

    if (error) {
      if (error.message.includes("unique")) {
        toast.error("Este nome já está em uso. Escolha outro.");
      } else {
        toast.error("Erro ao gerar link");
      }
    } else {
      toast.success("Link público ativado!");
      loadProfile();
    }
  };

  const togglePublicAccess = async () => {
    if (!user) return;

    const newStatus = !profile?.public_access_enabled;

    const { error } = await supabase
      .from("profiles")
      .update({ public_access_enabled: newStatus })
      .eq("id", user.id);

    if (error) {
      toast.error("Erro ao atualizar acesso público");
    } else {
      toast.success(newStatus ? "Acesso público ativado!" : "Acesso público desativado!");
      loadProfile();
    }
  };

  const copyPublicLink = () => {
    if (!profile?.public_slug) return;
    
    const link = `${window.location.origin}/student/${profile.public_slug}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setLinkCopied(false), 2000);
  };

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

    // Load collections owned by user or shared via class
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
              <PitecoLogo className="h-10 w-10" />
              <div>
                <h1 className="text-3xl font-bold">APE - Apprenticeship Practice and Enhancement</h1>
                {profile && (
                  <p className="text-lg mt-1 opacity-90">
                    Olá, {profile.first_name?.split(' ')[0] || profile.email?.split('@')[0] || 'Aluno'}!
                  </p>
                )}
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>

          <div className="max-w-3xl">
            <p className="text-lg mb-6 opacity-95">
              Organize seus flashcards em coleções e pratique com diferentes modos de estudo!
            </p>
            <div className="flex flex-wrap gap-4">
              <CreateCollectionDialog onCollectionCreated={loadCollections} />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none"></div>
      </section>

      {/* Public Link Section */}
      <section className="py-8 bg-muted/30">
        <div className="container mx-auto px-4">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Link Público para Alunos
              </CardTitle>
              <CardDescription>
                Gere um link para seus alunos acessarem suas coleções públicas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!profile?.public_slug ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Escolha um nome (ex: pedro)"
                    value={publicSlug}
                    onChange={(e) => setPublicSlug(e.target.value)}
                  />
                  <Button onClick={generatePublicLink}>
                    Gerar Link
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <code className="flex-1 text-sm">
                      {window.location.origin}/student/{profile.public_slug}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={copyPublicLink}
                    >
                      {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    variant={profile.public_access_enabled ? "destructive" : "default"}
                    onClick={togglePublicAccess}
                    className="w-full"
                  >
                    {profile.public_access_enabled ? "Desativar Link" : "Ativar Link"}
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">
                    {profile.public_access_enabled 
                      ? "✅ Link ativo - Alunos podem acessar suas coleções públicas" 
                      : "❌ Link desativado - Ninguém pode acessar"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
                  visibility={collection.visibility}
                  onSelect={() => navigate(`/collection/${collection.id}`)}
                  onDelete={loadCollections}
                  onToggleShare={loadCollections}
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
