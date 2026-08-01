import { Flame, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface StudyScopeEmptyStateProps {
  scope: "favorites" | "red-focus";
  onStudyAll: () => void;
  onBack: () => void;
  onStudyFavorites?: () => void;
}

export function StudyScopeEmptyState({
  scope,
  onStudyAll,
  onBack,
  onStudyFavorites,
}: StudyScopeEmptyStateProps) {
  const isRedFocus = scope === "red-focus";
  const Icon = isRedFocus ? Flame : Star;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <Card className="mx-auto max-w-xl space-y-5 p-6 text-center sm:p-8">
        <Icon
          className={isRedFocus ? "mx-auto h-12 w-12 text-red-500" : "mx-auto h-12 w-12 text-amber-500"}
          aria-hidden="true"
        />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {isRedFocus ? "Nenhum card em Foco Vermelho" : "Nenhum favorito nesta lista"}
          </h1>
          <p className="text-muted-foreground">
            A lista possui cards. Apenas o filtro selecionado não encontrou itens para esta sessão.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {isRedFocus && onStudyFavorites && (
            <Button onClick={onStudyFavorites}>Estudar favoritos</Button>
          )}
          <Button onClick={onStudyAll}>Estudar todos os cards</Button>
        </div>
        <Button variant="ghost" onClick={onBack}>Voltar para a lista</Button>
      </Card>
    </div>
  );
}
