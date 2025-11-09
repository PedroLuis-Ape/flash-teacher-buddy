import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeCardFolder } from "@/components/ape/ApeCardFolder";
import { ApeGrid } from "@/components/ape/ApeGrid";
import { ApeSectionTitle } from "@/components/ape/ApeSectionTitle";
import { BookOpen } from "lucide-react";

interface FolderType {
  id: string;
  title: string;
  description: string | null;
  list_count?: number;
  card_count?: number;
}

const PublicPortal = () => {
  const navigate = useNavigate();
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      const { data, error } = await supabase.rpc('get_portal_folders');

      if (error) throw error;

      // Load counts for each folder
      const foldersWithCounts = await Promise.all(
        (data || []).map(async (folder: any) => {
          const { data: countsData } = await supabase.rpc('get_portal_counts', {
            _folder_id: folder.id
          });

          const counts = countsData as any;

          return {
            ...folder,
            list_count: counts?.list_count || 0,
            card_count: counts?.card_count || 0,
          };
        })
      );

      setFolders(foldersWithCounts);
    } catch (error) {
      console.error("Error loading folders:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Portal do Aluno" />

      <div className="container mx-auto px-4 py-6">
        <ApeSectionTitle>
          Conteúdo Compartilhado
        </ApeSectionTitle>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Carregando...
          </div>
        ) : folders.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">
              Nenhum conteúdo público disponível no momento
            </p>
          </div>
        ) : (
          <ApeGrid>
            {folders.map((folder) => (
              <ApeCardFolder
                key={folder.id}
                title={folder.title}
                listCount={folder.list_count}
                cardCount={folder.card_count}
                onClick={() => navigate(`/portal/folder/${folder.id}`)}
              />
            ))}
          </ApeGrid>
        )}
      </div>
    </div>
  );
};

export default PublicPortal;
