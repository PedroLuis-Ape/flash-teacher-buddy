import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCcw, ArrowLeft } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("dynamically imported module") ||
    error.name === "ChunkLoadError"
  );
}

export class LazyErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: unknown) {
    console.error("[LazyErrorBoundary]", error);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-6 text-center space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            {this.state.isChunkError
              ? "Atualização disponível"
              : "Algo deu errado"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {this.state.isChunkError
              ? "Uma nova versão do app está disponível. Recarregue para continuar."
              : "Ocorreu um erro ao carregar esta página. Tente recarregar."}
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={this.handleReload}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Recarregar
            </Button>
            <Button variant="outline" onClick={this.handleGoHome}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Início
            </Button>
          </div>
        </Card>
      </div>
    );
  }
}
