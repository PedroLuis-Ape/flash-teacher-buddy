import { Database, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface StudyDeckEmptyStateProps {
  onRetry: () => void;
  onBack: () => void;
  isRetrying?: boolean;
  resourceLabel?: string;
}

export function StudyDeckEmptyState({
  onRetry,
  onBack,
  isRetrying = false,
  resourceLabel = "lista",
}: StudyDeckEmptyStateProps) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <Card className="mx-auto max-w-xl space-y-5 p-6 text-center sm:p-8">
        <Database className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Nenhum card disponível</h1>
          <p className="text-muted-foreground">
            Confirmamos que esta {resourceLabel} não possui cards jogáveis neste momento.
            Nenhum dado foi removido.
          </p>
        </div>
        <Button onClick={onRetry} disabled={isRetrying} className="w-full">
          <RefreshCcw className="mr-2 h-4 w-4" />
          {isRetrying ? "Verificando..." : "Verificar novamente"}
        </Button>
        <Button variant="ghost" onClick={onBack} className="w-full">
          Voltar para a lista
        </Button>
      </Card>
    </div>
  );
}
