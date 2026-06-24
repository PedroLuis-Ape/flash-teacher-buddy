import { ArrowLeft, BookOpen } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderGlossaryManager } from "@/features/study/components/FolderGlossaryManager";

export default function FolderGlossary() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: folder, isLoading } = useQuery({
    queryKey: ["folder-glossary-summary", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folders")
        .select("id,title,class_id,lang_a,lang_b,labels_a,labels_b")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Pasta não encontrada ou sem permissão.");
      return data;
    },
  });

  return (
    <main className="container mx-auto max-w-5xl px-4 py-5 pb-24">
      <div className="mb-5 flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/folder/${id}`)}
          aria-label="Voltar para a pasta"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="truncate text-2xl font-bold">Glossário da pasta</h1>
            {folder && (
              <Badge variant={folder.class_id ? "default" : "secondary"}>
                {folder.class_id ? "Turma" : "Pessoal"}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Carregando pasta..."
              : `${folder?.title ?? "Pasta"} · compartilhado por todas as listas`}
          </p>
        </div>
      </div>

      {id && folder && (
        <FolderGlossaryManager
          folderId={id}
          folderTitle={folder.title}
          labelA={folder.labels_a || folder.lang_a || "Lado A"}
          labelB={folder.labels_b || folder.lang_b || "Lado B"}
        />
      )}
    </main>
  );
}
