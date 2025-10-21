import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PitecoLogo } from "@/components/PitecoLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { ArrowLeft, Users, Calendar, Search, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Student {
  id: string;
  first_name: string | null;
  email: string | null;
  created_at: string;
  session_count?: number;
  last_activity?: string | null;
}

export default function MyStudents() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 12;

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

      // Buscar inscrições
      const { data: subscriptions, error } = await supabase
        .from("subscriptions")
        .select("student_id, created_at")
        .eq("teacher_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar dados de cada aluno
      const studentsData = await Promise.all((subscriptions || []).map(async (sub) => {
        // Buscar perfil do aluno
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, email")
          .eq("id", sub.student_id)
          .maybeSingle();

        // Buscar contagem de sessões do aluno
        const { count: sessionCount } = await supabase
          .from("practice_sessions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", sub.student_id);

        // Buscar última atividade
        const { data: lastSession } = await supabase
          .from("practice_sessions")
          .select("created_at")
          .eq("user_id", sub.student_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          id: sub.student_id,
          first_name: profile?.first_name || null,
          email: profile?.email || null,
          created_at: sub.created_at,
          session_count: sessionCount || 0,
          last_activity: lastSession?.created_at || null,
        };
      }));

      setStudents(studentsData);
      setFilteredStudents(studentsData);
    } catch (error: any) {
      toast.error("Erro ao carregar alunos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar e ordenar alunos
  useEffect(() => {
    let filtered = [...students];

    // Aplicar busca
    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Aplicar ordenação
    if (sortBy === "date") {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === "name") {
      filtered.sort((a, b) => (a.first_name || "").localeCompare(b.first_name || ""));
    }

    setFilteredStudents(filtered);
    setCurrentPage(1); // Reset para primeira página ao filtrar
  }, [searchTerm, sortBy, students]);

  // Paginação
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
  const startIndex = (currentPage - 1) * studentsPerPage;
  const endIndex = startIndex + studentsPerPage;
  const currentStudents = filteredStudents.slice(startIndex, endIndex);

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

        {/* Controles de busca e ordenação */}
        {!loading && students.length > 0 && (
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortBy} onValueChange={(value: "date" | "name") => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Data de inscrição</SelectItem>
                <SelectItem value="name">Nome (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-[200px]" />
                      <Skeleton className="h-4 w-[250px]" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : filteredStudents.length === 0 ? (
          <Card className="text-center p-12">
            <CardHeader>
              <CardTitle>
                {students.length === 0 ? "Nenhum aluno inscrito" : "Nenhum resultado encontrado"}
              </CardTitle>
              <CardDescription>
                {students.length === 0 
                  ? "Quando alunos se inscreverem em você, eles aparecerão aqui"
                  : "Tente ajustar sua busca ou filtros"
                }
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 mb-6">
              {currentStudents.map((student) => (
                <Card key={student.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}`} />
                        <AvatarFallback className="text-lg">
                          {student.first_name?.[0]?.toUpperCase() || "A"}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl mb-1">
                          {student.first_name || "Aluno"}
                        </CardTitle>
                        <CardDescription className="break-all">
                          {student.email}
                        </CardDescription>
                        
                        <div className="flex flex-wrap gap-4 mt-3 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Inscrito em {format(new Date(student.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          
                          {student.session_count !== undefined && student.session_count > 0 && (
                            <div className="flex items-center gap-2 text-primary">
                              <TrendingUp className="h-4 w-4" />
                              <span>
                                {student.session_count} {student.session_count === 1 ? "sessão" : "sessões"}
                              </span>
                            </div>
                          )}
                          
                          {student.last_activity && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Users className="h-4 w-4" />
                              <span>
                                Último acesso: {format(new Date(student.last_activity), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
