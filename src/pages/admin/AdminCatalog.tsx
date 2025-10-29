import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, Archive } from "lucide-react";
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
import { getRarityColor, getRarityLabel } from "@/lib/storeEngine";

export default function AdminCatalog() {
  const [skins, setSkins] = useState<any[]>([]);
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
    loadSkins();
  };

  const loadSkins = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('skins_catalog')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading skins:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o catálogo.",
        variant: "destructive",
      });
    } else {
      setSkins(data || []);
    }
    setLoading(false);
  };

  const toggleStatus = async (skinId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'archived' : 'published';
    
    const { error } = await supabase
      .from('skins_catalog')
      .update({ status: newStatus })
      .eq('id', skinId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Status atualizado",
        description: `Skin ${newStatus === 'published' ? 'publicada' : 'arquivada'} com sucesso.`,
      });
      loadSkins();
    }
  };

  const deleteSkin = async (skinId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta skin? Esta ação não pode ser desfeita.')) {
      return;
    }

    const { error } = await supabase
      .from('skins_catalog')
      .delete()
      .eq('id', skinId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível deletar a skin.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Skin deletada",
        description: "A skin foi removida do catálogo.",
      });
      loadSkins();
    }
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Catálogo de Skins</h1>
          <p className="text-muted-foreground">Gerenciar pacotes da loja</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Skin
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todas as Skins</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Preview</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Raridade</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skins.map((skin) => (
                <TableRow key={skin.id}>
                  <TableCell>
                    <img 
                      src={skin.card_img} 
                      alt={skin.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{skin.name}</TableCell>
                  <TableCell>
                    <Badge style={{ backgroundColor: getRarityColor(skin.rarity) }}>
                      {getRarityLabel(skin.rarity)}
                    </Badge>
                  </TableCell>
                  <TableCell>₱{skin.price_pitecoin}</TableCell>
                  <TableCell>
                    <Badge variant={skin.status === 'published' ? 'default' : 'secondary'}>
                      {skin.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={skin.is_active ? 'default' : 'destructive'}>
                      {skin.is_active ? 'Sim' : 'Não'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => toggleStatus(skin.id, skin.status)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteSkin(skin.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {skins.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma skin no catálogo. Clique em "Nova Skin" para começar.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}