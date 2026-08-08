import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isPublicPath } from "@/lib/sessionRouteAccess";

export function AuthHydrationGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { status, retryHydration } = useAuth();

  if (isPublicPath(location.pathname)) return <>{children}</>;

  if (status === "initializing" || status === "stale") {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-6">
        <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-foreground">
            {status === "stale" ? "A conexão com sua sessão está instável." : "Restaurando sua sessão..."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Seus dados continuam preservados. Aguarde ou tente validar novamente.
          </p>
          {status === "stale" && (
            <button
              type="button"
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              onClick={retryHydration}
            >
              Tentar novamente
            </button>
          )}
        </section>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-6">
        <section className="w-full max-w-lg rounded-2xl border border-destructive/40 bg-card p-6 text-center shadow-sm" role="alert">
          <p className="text-sm font-semibold text-foreground">Não foi possível validar sua sessão.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            A autenticação não respondeu a tempo ou recusou a sessão. Nenhum dado foi removido.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              onClick={retryHydration}
            >
              Tentar novamente
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground"
              onClick={() => navigate("/landing")}
            >
              Voltar ao início
            </button>
          </div>
        </section>
      </div>
    );
  }

  // SessionWatcher performs the redirect. Keeping the private tree unmounted
  // prevents legacy pages from running their own getSession() during the race.
  if (status !== "authenticated") return null;

  return <>{children}</>;
}
