import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, Archive, ArrowLeft, FileText, Store, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { AdminCatalogForm } from "./AdminCatalogForm";
import { logAdminAction } from "@/lib/adminLogger";

export default function AdminCatalog() {
  const [skins, setSkins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSkin, setEditingSkin] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; skin: any }>({ open: false, skin: null });
  const [archiveDialog, setArchiveDialog] = useState<{ open: boolean; skin: any }>({ open: false, skin: null });
  const [inStore, setInStore] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
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

    // Carregar quais skins estão no catálogo público
    const { data: publicData } = await supabase
      .from('public_catalog')
      .select('id')
      .eq('is_active', true);
    
    if (publicData) {
      setInStore(new Set(publicData.map(s => s.id)));
    }

    setLoading(false);
  };

  const publishToStore = async (skin: any) => {
    setPublishing(skin.id);
    
    const { data, error } = await supabase.rpc('publish_skin_to_store', {
      p_skin_id: skin.id
    });

    const result = data as { success: boolean; message?: string } | null;

    if (error || !result?.success) {
      toast({
        title: "❌ Erro",
        description: result?.message || "Não foi possível publicar na loja.",
        variant: "destructive",
      });
    } else {
      await logAdminAction('publish_to_store', skin.name, { 
        rarity: skin.rarity,
        price: skin.price_pitecoin 
      });
      
      toast({
        title: "✅ Publicado na loja",
        description: "Skin agora está disponível para todos os usuários!",
      });
      
      // Atualizar lista de skins na loja
      setInStore(prev => new Set([...prev, skin.id]));
    }
    
    setPublishing(null);
  };

  const importNewPackages = async () => {
    setImporting(true);

    try {
      const { data, error } = await supabase.functions.invoke('store-admin-batch-import');

      if (error) {
        throw error;
      }

      const result = data as { success: boolean; successCount: number; errorCount: number; results: any[] };

      if (result.success) {
        toast({
          title: "✅ Pacotes importados",
          description: `${result.successCount} pacote(s) adicionado(s) à loja com sucesso!`,
        });
        
        // Log each successful import
        for (const pkg of result.results.filter((r: any) => r.success)) {
          await logAdminAction('import_package', pkg.title, { 
            sku: pkg.sku,
          });
        }
        
        loadSkins();
      }

      if (result.errorCount > 0) {
        toast({
          title: "⚠️ Alguns erros",
          description: `${result.errorCount} pacote(s) falharam na importação.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error importing packages:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível importar os pacotes. Tente novamente.",
        variant: "destructive",
      });
    }

    setImporting(false);
  };

  const confirmToggleStatus = async () => {
    if (!archiveDialog.skin) return;
    
    const skin = archiveDialog.skin;
    const newStatus = skin.status === 'published' ? 'archived' : 'published';
    
    const { error } = await supabase
      .from('skins_catalog')
      .update({ status: newStatus })
      .eq('id', skin.id);

    if (error) {
      toast({
        title: "❌ Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    } else {
      await logAdminAction(
        newStatus === 'archived' ? 'archive_package' : 'publish_package',
        skin.name,
        { old_status: skin.status, new_status: newStatus }
      );
      
      toast({
        title: "✅ Status atualizado",
        description: `Skin ${newStatus === 'published' ? 'publicada' : 'arquivada'} com sucesso.`,
      });
      loadSkins();
    }
    setArchiveDialog({ open: false, skin: null });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.skin) return;
    
    const skin = deleteDialog.skin;
    
    const { error } = await supabase
      .from('skins_catalog')
      .delete()
      .eq('id', skin.id);

    if (error) {
      toast({
        title: "❌ Erro",
        description: "Não foi possível deletar a skin.",
        variant: "destructive",
      });
    } else {
      await logAdminAction('delete_package', skin.name, { 
        rarity: skin.rarity,
        price: skin.price_pitecoin 
      });
      
      toast({
        title: "✅ Skin excluída",
        description: "A skin foi removida permanentemente do catálogo.",
      });
      loadSkins();
    }
    setDeleteDialog({ open: false, skin: null });
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

  if (showForm || editingSkin) {
    return (
      <div className="container max-w-4xl py-8">
        <AdminCatalogForm
          skin={editingSkin}
          onSuccess={() => {
            setShowForm(false);
            setEditingSkin(null);
            loadSkins();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingSkin(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/store')}
            aria-label="Voltar à Loja"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Catálogo de Skins</h1>
            <p className="text-muted-foreground">Gerenciar pacotes da loja</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={importNewPackages}
            disabled={importing}
          >
            <Upload className={`h-4 w-4 mr-2 ${importing ? 'animate-pulse' : ''}`} />
            Importar Novos
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/logs')}>
            <FileText className="h-4 w-4 mr-2" />
            Logs
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Skin
          </Button>
        </div>
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
                <TableHead>Na Loja</TableHead>
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
                  <TableCell>
                    {inStore.has(skin.id) ? (
                      <Badge variant="default" className="bg-green-600">
                        ✓ Sim
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Não
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setEditingSkin(skin)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {skin.status === 'published' && skin.is_active && !inStore.has(skin.id) && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => publishToStore(skin)}
                          disabled={publishing === skin.id}
                          title="Publicar na Loja"
                        >
                          <Store className={`h-4 w-4 ${publishing === skin.id ? 'animate-pulse' : ''}`} />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setArchiveDialog({ open: true, skin })}
                        title={skin.status === 'published' ? 'Arquivar' : 'Publicar'}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setDeleteDialog({ open: true, skin })}
                        title="Excluir permanentemente"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, skin: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Excluir Pacote</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e não pode ser desfeita.
              <br />
              Deseja realmente excluir o pacote <strong>{deleteDialog.skin?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive/Publish Confirmation Dialog */}
      <AlertDialog open={archiveDialog.open} onOpenChange={(open) => setArchiveDialog({ open, skin: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveDialog.skin?.status === 'published' ? 'Arquivar Pacote' : 'Publicar Pacote'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveDialog.skin?.status === 'published' ? (
                <>
                  O pacote será removido da loja, mas continuará salvo no painel.
                  <br />
                  Deseja arquivar <strong>{archiveDialog.skin?.name}</strong>?
                </>
              ) : (
                <>
                  O pacote será publicado e ficará visível na loja.
                  <br />
                  Deseja publicar <strong>{archiveDialog.skin?.name}</strong>?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleStatus}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}