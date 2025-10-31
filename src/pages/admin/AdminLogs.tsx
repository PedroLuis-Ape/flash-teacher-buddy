import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, [navigate]);

  const checkAdminAccess = async () => {
    if (!FEATURE_FLAGS.admin_skins_enabled) {
      navigate('/');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }

    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!role || (role.role as string) !== 'developer_admin') {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      navigate('/');
      return;
    }

    setIsAdmin(true);
    loadLogs();
  };

  const loadLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading logs:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os logs.",
        variant: "destructive",
      });
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  const getActionBadge = (action: string) => {
    const colorMap: Record<string, "default" | "secondary" | "destructive"> = {
      create_package: "default",
      update_package: "secondary",
      delete_package: "destructive",
      archive_package: "secondary",
      publish_package: "default",
    };
    return colorMap[action] || "secondary";
  };

  const getActionLabel = (action: string) => {
    const labelMap: Record<string, string> = {
      create_package: "Criou pacote",
      update_package: "Editou pacote",
      delete_package: "Excluiu pacote",
      archive_package: "Arquivou pacote",
      publish_package: "Publicou pacote",
    };
    return labelMap[action] || action;
  };

  if (!isAdmin || loading) {
    return (
      <div className="container max-w-6xl py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p>{loading ? 'Carregando...' : 'Acesso negado'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin/catalog')}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Logs Administrativos</h1>
          <p className="text-muted-foreground">Histórico de ações realizadas</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas 100 ações</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionBadge(log.action)}>
                      {getActionLabel(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{log.target}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.details && Object.keys(log.details).length > 0
                      ? JSON.stringify(log.details, null, 2)
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {logs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum log registrado ainda.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
