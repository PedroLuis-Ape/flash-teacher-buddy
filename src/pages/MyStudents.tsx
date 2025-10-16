import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PitecoLogo } from "@/components/PitecoLogo";
import { toast } from "sonner";
import { ArrowLeft, Users } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Student {
  id: string;
  first_name: string | null;
  email: string | null;
  created_at: string;
}

const MyStudents = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndRole();
  }, []);

  const checkAuthAndRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (roleData) {
      setUserRole(roleData.role);
      if (roleData.role !== 'owner') {
        toast.error("Apenas professores podem acessar esta página");
        navigate("/folders");
        return;
      }
      loadStudents(session.user.id);
    }
  };

  const loadStudents = async (teacherId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("student_id, created_at")
        .eq("teacher_id", teacherId);

      if (error) throw error;

      if (data && data.length > 0) {
        const studentIds = data.map(s => s.student_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, email")
          .in("id", studentIds);

        if (profilesError) throw profilesError;

        const studentsWithDates = profilesData?.map(profile => {
          const subscription = data.find(s => s.student_id === profile.id);
          return {
            ...profile,
            created_at: subscription?.created_at || "",
          };
        }) || [];

        setStudents(studentsWithDates);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar alunos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <PitecoLogo className="w-16 h-16" />
            <div>
              <h1 className="text-3xl font-bold">Meus Alunos</h1>
              <p className="text-muted-foreground">Alunos inscritos em você</p>
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
        ) : students.length === 0 ? (
          <Card className="text-center p-12">
            <CardHeader>
              <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle>Nenhum aluno inscrito ainda</CardTitle>
              <CardDescription>
                Quando alunos se inscreverem em você, eles aparecerão aqui
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4">
            {students.map((student) => (
              <Card key={student.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{student.first_name || "Aluno"}</CardTitle>
                      <CardDescription>{student.email}</CardDescription>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Inscrito em: {new Date(student.created_at).toLocaleDateString('pt-BR')}
                    </p>
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

export default MyStudents;
