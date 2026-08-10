import { AlertTriangle, ArrowLeft, RefreshCcw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface StudySessionRecoveryProps {
  onRetry: () => void;
  onStartFresh: () => void;
  onBack: () => void;
  isRetrying?: boolean;
  technicalId?: string;
  allowStartFresh?: boolean;
  diagnostic?: {
    title: string;
    description: string;
    details: string[];
    action: string;
  };
}

export function StudySessionRecovery({
  onRetry,
  onStartFresh,
  onBack,
  isRetrying = false,
  technicalId,
  allowStartFresh = true,
  diagnostic,
}: StudySessionRecoveryProps) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <Card className="mx-auto max-w-xl space-y-5 p-6 text-center sm:p-8">
        <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" aria-hidden="true" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Não foi possível preparar esta sessão</h1>
          <p className="text-muted-foreground">
            {allowStartFresh
              ? "Seus cards e preferências continuam preservados. Você pode tentar recuperar a sessão ou começar uma nova neste modo."
              : "Não conseguimos carregar os cards desta vez. Seus dados continuam preservados; tente novamente ou volte para a lista."}
          </p>
        </div>
        <div className={`grid gap-2 ${allowStartFresh ? "sm:grid-cols-2" : ""}`}>
          <Button onClick={onRetry} disabled={isRetrying}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {isRetrying ? "Tentando..." : "Tentar novamente"}
          </Button>
          {allowStartFresh && <Button variant="outline" onClick={onStartFresh}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Iniciar sessão nova
          </Button>}
        </div>
        {diagnostic && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-left text-sm">
            <p className="font-semibold text-foreground">{diagnostic.title}</p>
            <p className="mt-1 text-muted-foreground">{diagnostic.description}</p>
            <ul className="mt-3 space-y-1 text-muted-foreground">
              {diagnostic.details.map((detail) => <li key={detail}>• {detail}</li>)}
            </ul>
            <p className="mt-3 text-muted-foreground"><span className="font-medium text-foreground">Próximo passo:</span> {diagnostic.action}</p>
          </div>
        )}
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para a lista
        </Button>
        {technicalId && (
          <p className="text-xs text-muted-foreground">
            Identificador técnico: <code>{technicalId}</code>
          </p>
        )}
      </Card>
    </div>
  );
}
