import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PitecoLogo } from "@/components/PitecoLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { ArrowLeft, User, FolderOpen, Calendar, UserMinus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Teacher {
  id: string;
  first_name: string | null;
  public_slug: string | null;
  created_at: string;
  folder_count?: number;
}

export default function MyTeachers() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    loadTeachers();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("subscriptions")
        .select("teacher_id, created_at")
        .eq("student_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar perfis dos professores sem depender de FK
      const teacherIds = Array.from(new Set((data || []).map((s) => s.teacher_id)));

      const profileMap = new Map<string, { id: string; first_name: string | null; public_slug: string | null }>();
      if (teacherIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, public_slug")
          .in("id", teacherIds);
        if (profilesError) throw profilesError;
        profilesData?.forEach((p) =>
          profileMap.set(p.id, { id: p.id, first_name: p.first_name ?? null, public_slug: p.public_slug ?? null })
        );
      }

      // Garantir apenas uma inscrição por professor
      const firstSubByTeacher = new Map<string, (typeof data)[number]>();
      (data || []).forEach((sub) => {
        if (!firstSubByTeacher.has(sub.teacher_id)) firstSubByTeacher.set(sub.teacher_id, sub);
      });
      const subsToProcess = Array.from(firstSubByTeacher.values());

      const teachersData = await Promise.all(
        subsToProcess.map(async (sub) => {
          const { count } = await supabase
            .from("folders")
            .select("*", { count: "exact", head: true })
            .eq("owner_id", sub.teacher_id)
            .eq("visibility", "class");

          const profile = profileMap.get(sub.teacher_id);

          return {
            id: sub.teacher_id,
            first_name: profile?.first_name ?? null,
            public_slug: profile?.public_slug ?? null,
            created_at: sub.created_at,
            folder_count: count || 0,
          };
        })
      );

      setTeachers(teachersData);
    } catch (error: any) {
      toast.error("Erro ao carregar professores: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const goToTeacherFolders = async (teacherId: string) => {
    try {
      const { data, error } = await supabase
        .from("folders")
        .select("id")
        .eq("owner_id", teacherId)
        .eq("visibility", "class")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        navigate(`/folder/${data.id}`);
      } else {
        toast.info("Este professor ainda não tem pastas compartilhadas");
      }
    } catch (error: any) {
      toast.error("Erro ao acessar pastas");
    }
  };

  const handleUnsubscribe = async (teacherId: string, teacherName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("subscriptions")
        .delete()
        .eq("student_id", session.user.id)
        .eq("teacher_id", teacherId);

      if (error) throw error;

      toast.success(`Você se desinscreveu de ${teacherName}`);
      loadTeachers();
    } catch (error: any) {
      toast.error("Erro ao desinscrever: " + error.message);
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
              <p className="text-muted-foreground">Professores em que você está inscrito</p>
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
              <CardTitle>Nenhum professor ainda</CardTitle>
              <CardDescription>
                Busque professores e inscreva-se para ter acesso às suas pastas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/search")}>
                Buscar Professores
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {teachers.map((teacher) => (
              <Card key={teacher.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="h-8 w-8 text-primary" />
                      <div>
                        <CardTitle>
                          {teacher.first_name || "Professor"}
                          {teacher.public_slug && (
                            <span className="ml-2 text-sm text-primary font-medium">
                              @{teacher.public_slug}
                            </span>
                          )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <FolderOpen className="h-4 w-4" />
                          {teacher.folder_count} pasta{teacher.folder_count !== 1 ? "s" : ""} compartilhada{teacher.folder_count !== 1 ? "s" : ""}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {format(new Date(teacher.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => goToTeacherFolders(teacher.id)}
                          variant="outline"
                          size="sm"
                        >
                          Ver Pastas
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <UserMinus className="h-4 w-4 mr-1" />
                              Desinscrever
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Desinscrever-se?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja se desinscrever de {teacher.first_name || "este professor"}? 
                                Você não terá mais acesso às pastas compartilhadas.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleUnsubscribe(teacher.id, teacher.first_name || "Professor")}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Sim, desinscrever
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
