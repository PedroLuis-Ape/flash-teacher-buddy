import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FolderOpen, FileText, CreditCard } from "lucide-react";
import { PitecoMascot } from "@/components/PitecoMascot";

interface Folder {
  id: string;
  title: string;
  description?: string;
  list_count?: number;
  card_count?: number;
}

export default function PublicPortal() {
  const navigate = useNavigate();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSharedFolders();
  }, []);

  const loadSharedFolders = async () => {
    try {
      setLoading(true);

      // Carregar pastas públicas via RPC com security definer
      const { data: rpcFolders, error: rpcError } = await supabase.rpc('get_portal_folders');
      if (rpcError) throw rpcError;

      const foldersWithCounts = await Promise.all(
        (rpcFolders || []).map(async (folder: any) => {
          const { data: counts } = await supabase.rpc('get_portal_counts', { _folder_id: folder.id });
          return {
            ...folder,
            list_count: counts?.[0]?.list_count ?? 0,
            card_count: counts?.[0]?.card_count ?? 0,
          };
        })
      );

      setFolders(foldersWithCounts);
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
          <Button 
            variant="ghost" 
            className="text-primary-foreground hover:bg-white/20"
            onClick={() => navigate("/auth")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
              Portal do Aluno
            </h1>
            <p className="text-xl text-primary-foreground/90">
              Professor Pedro
            </p>
          </div>

          {folders.length === 0 ? (
            <Card className="bg-white/95 backdrop-blur">
              <CardContent className="py-12 text-center">
                <FolderOpen className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground mb-2">
                  Ainda não há pastas compartilhadas disponíveis.
                </p>
                <p className="text-sm text-muted-foreground">
                  O professor precisa compartilhar as pastas marcando a opção "Permitir acesso sem login".
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {folders.map((folder) => (
                <Card 
                  key={folder.id}
                  className="bg-white/95 backdrop-blur hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => navigate(`/folder/${folder.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-2xl mb-2">{folder.title}</CardTitle>
                        {folder.description && (
                          <CardDescription className="text-base">
                            {folder.description}
                          </CardDescription>
                        )}
                      </div>
                      <FolderOpen className="h-8 w-8 text-primary ml-4" />
                    </div>
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
    </div>
  );
}
