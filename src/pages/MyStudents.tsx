import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PitecoLogo } from "@/components/PitecoLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { ArrowLeft, Users, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Student {
  id: string;
  first_name: string | null;
  email: string | null;
  created_at: string;
}

export default function MyStudents() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    loadStudents();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (roleData?.role !== 'owner') {
      toast.error("Apenas professores podem acessar esta página");
      navigate("/folders");
      return;
    }

    setUserRole(roleData.role);
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          student_id,
          created_at,
          profiles:student_id (
            id,
            first_name,
            email
          )
        `)
        .eq("teacher_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const studentsData = (data || []).map(sub => ({
        id: sub.student_id,
        first_name: (sub.profiles as any)?.first_name || null,
        email: (sub.profiles as any)?.email || null,
        created_at: sub.created_at,
      }));

      setStudents(studentsData);
    } catch (error: any) {
      toast.error("Erro ao carregar alunos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-8"> {/* PATCH: wrap no mobile */}
          <div className="flex items-center gap-4">
            <PitecoLogo className="w-16 h-16" />
            <div>
              <h1 className="text-3xl font-bold">Meus Alunos</h1>
              <p className="text-muted-foreground">Alunos inscritos em você</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center"> {/* PATCH: wrap no mobile */}
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
              <CardTitle>Nenhum aluno inscrito</CardTitle>
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
                    <div className="flex items-center gap-3">
                      <Users className="h-8 w-8 text-primary" />
                      <div>
                        <CardTitle>{student.first_name || "Aluno"}</CardTitle>
                        <CardDescription>{student.email}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Inscrito em {format(new Date(student.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
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
}
