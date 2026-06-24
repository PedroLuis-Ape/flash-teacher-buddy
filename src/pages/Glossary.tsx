import { BookOpen, FolderOpen } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FolderGlossaryManager } from "@/features/study/components/FolderGlossaryManager";
import { supabase } from "@/integrations/supabase/client";

export default function Glossary() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const folderId = params.get("folder") || undefined;

  const { data: folder, isLoading, error } = useQuery({
    queryKey: ["folder-glossary-summary", folderId],
    enabled: Boolean(folderId),
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("folders")
        .select("id,title,class_id,lang_a,lang_b,labels_a,labels_b")
        .eq("id", folderId)
        .maybeSingle();
      if (queryError) throw queryError;
      if (!data) throw new Error("Pasta não encontrada ou sem permissão.");
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title={folderId ? "Glossário da pasta" : "Glossários por pasta"} showBack />
      <main className="container mx-auto max-w-5xl space-y-4 p-4 pb-24">
        {!folderId ? (
          <Card className="border-primary/25 bg-primary/5 p-8 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 text-xl font-semibold">O glossário agora pertence à pasta</h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              Abra uma pasta e escolha “Glossário da pasta”. Assim, cada tema mantém
              traduções próprias e nenhuma palavra se mistura com outras pastas ou turmas.
            </p>
            <Button className="mt-5" onClick={() => navigate("/folders")}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Abrir minhas pastas
            </Button>
          </Card>
        ) : isLoading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Carregando glossário da pasta...
          </Card>
        ) : error || !folder ? (
          <Card className="p-8 text-center text-sm text-destructive">
            Não foi possível abrir esta pasta ou você não possui acesso.
          </Card>
        ) : (
          <>
            <Card className="border-primary/25 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold">{folder.title}</h1>
                <Badge variant={folder.class_id ? "default" : "secondary"}>
                  {folder.class_id ? "Turma" : "Pessoal"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Um único glossário compartilhado por todas as listas desta pasta.
              </p>
            </Card>

            <FolderGlossaryManager
              folderId={folder.id}
              folderTitle={folder.title}
              labelA={folder.labels_a || folder.lang_a || "Lado A"}
              labelB={folder.labels_b || folder.lang_b || "Lado B"}
            />
          </>
        )}
      </main>
    </div>
  );
}
