import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PitecoLogo } from "@/components/PitecoLogo";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap, FolderOpen } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Teacher {
  id: string;
  first_name: string | null;
  public_slug: string | null;
  created_at: string;
  folder_count?: number;
}

const MyTeachers = () => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }
    loadTeachers(session.user.id);
  };

  const loadTeachers = async (studentId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("teacher_id, created_at")
        .eq("student_id", studentId);

      if (error) throw error;

      if (data && data.length > 0) {
        const teacherIds = data.map(s => s.teacher_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, public_slug")
          .in("id", teacherIds);

        if (profilesError) throw profilesError;

        const teachersWithData = await Promise.all(
          (profilesData || []).map(async (profile) => {
            const subscription = data.find(s => s.teacher_id === profile.id);
            
            const { count } = await supabase
              .from("folders")
              .select("*", { count: "exact", head: true })
              .eq("owner_id", profile.id)
              .eq("visibility", "class");

            return {
              ...profile,
              created_at: subscription?.created_at || "",
              folder_count: count || 0,
            };
          })
        );

        setTeachers(teachersWithData);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar professores: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async (teacherId: string) => {
    const confirm = window.confirm("Tem certeza de que deseja cancelar a inscrição?");
    if (!confirm) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("subscriptions")
        .delete()
        .eq("teacher_id", teacherId)
        .eq("student_id", session.user.id);

      if (error) throw error;

      toast.success("Inscrição cancelada com sucesso!");
      loadTeachers(session.user.id);
    } catch (error: any) {
      toast.error("Erro ao cancelar inscrição: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <PitecoLogo className="w-16 h-16" />
            <div>
              <h1 className="text-3xl font-bold">Meus Professores</h1>
              <p className="text-muted-foreground">Professores que você segue</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <ThemeToggle />
            <Button onClick={() => navigate("/folders")} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Carregando...</p>
        ) : teachers.length === 0 ? (
          <Card className="text-center p-12">
            <CardHeader>
              <GraduationCap className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle>Nenhuma inscrição ainda</CardTitle>
              <CardDescription>
                Use a busca para encontrar professores e se inscrever neles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/search")} className="mt-4">
                Buscar Professores
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {teachers.map((teacher) => (
              <Card key={teacher.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5" />
                        {teacher.first_name || "Professor"}
                        {teacher.public_slug && (
                          <span className="text-primary font-normal">@{teacher.public_slug}</span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {teacher.folder_count} pasta{teacher.folder_count !== 1 ? "s" : ""} compartilhada{teacher.folder_count !== 1 ? "s" : ""}
                      </CardDescription>
                      <p className="text-xs text-muted-foreground mt-1">
                        Inscrito em: {new Date(teacher.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => navigate("/search")}
                      >
                        <FolderOpen className="mr-2 h-4 w-4" />
                        Ver Pastas
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => unsubscribe(teacher.id)}
                      >
                        Cancelar Inscrição
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTeachers;
