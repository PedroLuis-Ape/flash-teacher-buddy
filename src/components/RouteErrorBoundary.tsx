import { Component, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCcw, ArrowLeft, Home } from "lucide-react";
import {
  isChunkLoadError,
  reloadForAppUpdate,
  tryOneChunkRetry,
} from "@/lib/appUpdateRecovery";

/**
 * RouteErrorBoundary — isolates errors to the route content area.
 * The app shell (header/tab bar/sidebar) stays mounted while a route recovers.
 *
 * Chunk-load failures get one automatic reload per real build timestamp and
 * pathname. The explicit retry button performs a cache-busted navigation so a
 * stale tab fetches the current HTML/module graph instead of retrying the same
 * missing chunk in memory.
 */

interface Props {
  children: ReactNode;
  locationKey: string;
  onReset: () => void;
  onNavigateHome: () => void;
  onNavigateBack: () => void;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
  message: string;
}

class InnerRouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isChunkError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      isChunkError: isChunkLoadError(error),
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    console.error("[RouteErrorBoundary]", error);
    tryOneChunkRetry(error);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.locationKey !== this.props.locationKey) {
      this.setState({ hasError: false, isChunkError: false, message: "" });
    }
  }

  handleRetry = () => {
    if (this.state.isChunkError) {
      reloadForAppUpdate();
      return;
    }

    this.setState({ hasError: false, isChunkError: false, message: "" });
    this.props.onReset();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const { isChunkError } = this.state;

    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md p-6 text-center space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            {isChunkError ? "Atualização disponível" : "Erro ao carregar esta página"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isChunkError
              ? "Uma nova versão do app está disponível. Atualize para continuar de onde parou."
              : "O restante do app continua funcionando. Você pode tentar de novo ou navegar para outra área."}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button onClick={this.handleRetry}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              {isChunkError ? "Atualizar agora" : "Tentar novamente"}
            </Button>
            <Button variant="outline" onClick={this.props.onNavigateBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button variant="outline" onClick={this.props.onNavigateHome}>
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <InnerRouteErrorBoundary
      locationKey={location.key}
      onReset={() => {
        navigate(location.pathname + location.search, { replace: true });
      }}
      onNavigateHome={() => navigate("/dashboard")}
      onNavigateBack={() => navigate(-1)}
    >
      {children}
    </InnerRouteErrorBoundary>
  );
}
