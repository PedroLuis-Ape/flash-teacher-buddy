import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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

interface Profile {
  first_name?: string;
  public_slug?: string;
}

export default function StudentPortal() {
  const { teacherSlug } = useParams<{ teacherSlug: string }>();
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [teacher, setTeacher] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [flashcardCounts, setFlashcardCounts] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    loadTeacherAndCollections();
  }, [teacherSlug]);

  const loadTeacherAndCollections = async () => {
    try {
      setLoading(true);

      // Find teacher by public slug
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, first_name, public_slug, public_access_enabled")
        .eq("public_slug", teacherSlug)
        .eq("public_access_enabled", true)
        .single();

      if (profileError || !profileData) {
        console.error("Teacher not found or public access disabled:", profileError);
        navigate("/auth");
        return;
      }

      setTeacher(profileData);

      // Load teacher's public collections
      const { data: collectionsData, error: collectionsError } = await supabase
        .from("collections")
        .select("*")
        .eq("owner_id", profileData.id)
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
          <Link to="/auth">
            <Button variant="ghost" className="text-primary-foreground hover:bg-white/20">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
              Portal do Aluno
            </h1>
            <p className="text-xl text-primary-foreground/90">
              {teacher?.first_name ? `Professor(a) ${teacher.first_name}` : "Portal de Estudos"}
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
                  onClick={() => navigate(`/student/${teacherSlug}/collection/${collection.id}`)}
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
