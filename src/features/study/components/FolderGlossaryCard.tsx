import { BookOpen, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useFolderGlossary } from "@/hooks/useFolderGlossary";
import { cn } from "@/lib/utils";

interface FolderGlossaryCardProps {
  folderId: string;
  className?: string;
}

export function FolderGlossaryCard({ folderId, className }: FolderGlossaryCardProps) {
  const navigate = useNavigate();
  const { entries, canEdit, isLoading } = useFolderGlossary(folderId);

  return (
    <button
      type="button"
      className={cn("w-full text-left", className)}
      onClick={() => navigate(`/glossary?folder=${folderId}`)}
    >
      <Card className="border-primary/30 bg-primary/5 transition-all hover:border-primary/60 hover:bg-primary/10 hover:shadow-md active:scale-[0.99]">
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">Glossário da pasta</p>
              <Badge variant="secondary">
                {isLoading ? "…" : `${entries.length} termo${entries.length === 1 ? "" : "s"}`}
              </Badge>
              {!canEdit && <Badge variant="outline">Somente leitura</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Compartilhado por todas as listas desta pasta
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </button>
  );
}
