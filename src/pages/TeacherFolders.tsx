import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PitecoLogo } from "@/components/PitecoLogo";
import { toast } from "sonner";
import { ArrowLeft, Folder, FileText, CreditCard, Globe } from "lucide-react";

interface FolderType {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  list_count?: number;
  card_count?: number;
}

const TeacherFolders = () => {
  const navigate = useNavigate();
  const { teacherId } = useParams<{ teacherId: string }>();
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState("");

  useEffect(() => {
    checkAuth();
    loadTeacherFolders();
  }, [teacherId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }
  };

  const loadTeacherFolders = async () => {
    if (!teacherId) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Verificar se o usuário está inscrito neste professor
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("student_id", session.user.id)
        .eq("teacher_id", teacherId)
        .maybeSingle();

      if (!subscription) {
        toast.error("Você não está inscrito neste professor");
        navigate("/folders", { replace: true });
        return;
      }

      // Buscar nome do professor
      const { data: teacherProfile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", teacherId)
        .single();

      if (teacherProfile) {
        setTeacherName(teacherProfile.first_name || "Professor");
      }

      // Buscar pastas compartilhadas do professor
      const { data: foldersData, error } = await supabase
        .from("folders")
        .select("*")
        .eq("owner_id", teacherId)
        .eq("visibility", "class")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Carregar contadores para cada pasta
      const foldersWithCounts = await Promise.all(
        (foldersData || []).map(async (folder) => {
          const { data: lists } = await supabase
            .from("lists")
            .select("id")
            .eq("folder_id", folder.id);

          const listIds = lists?.map(l => l.id) || [];
          
          let cardCount = 0;
          if (listIds.length > 0) {
            const { count } = await supabase
              .from("flashcards")
              .select("*", { count: "exact", head: true })
              .in("list_id", listIds);
            cardCount = count || 0;
          }

          return {
            ...folder,
            list_count: lists?.length || 0,
            card_count: cardCount,
          };
        })
      );

      setFolders(foldersWithCounts);
    } catch (error: any) {
      toast.error("Erro ao carregar pastas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <PitecoLogo className="w-16 h-16" />
            <div>
              <h1 className="text-3xl font-bold">Professor {teacherName}</h1>
              <p className="text-muted-foreground">
                Pastas compartilhadas
              </p>
            </div>
          </div>
          <Button onClick={() => navigate("/folders")} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Carregando pastas...</p>
            </div>
          </div>
        ) : folders.length === 0 ? (
          <Card className="text-center p-12">
            <CardHeader>
              <CardTitle>Nenhuma pasta compartilhada</CardTitle>
              <CardDescription>
                Este professor ainda não compartilhou nenhuma pasta com você
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {folders.map((folder) => (
              <Card
                key={folder.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/folder/${folder.id}`)}
              >
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Folder className="h-8 w-8 text-primary" />
                    <Globe className="h-4 w-4 text-accent" />
                  </div>
                  <CardTitle>{folder.title}</CardTitle>
                  {folder.description && (
                    <CardDescription>{folder.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      <span>{folder.list_count || 0} listas</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CreditCard className="h-4 w-4" />
                      <span>{folder.card_count || 0} cards</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherFolders;
