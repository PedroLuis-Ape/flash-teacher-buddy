/**
 * APE – Apprentice Practice & Enhancement
 * OAuth 2.1 consent screen for MCP clients (Lovable, ChatGPT, Claude, etc.)
 * Route: /.lovable/oauth/consent
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type AuthorizationDetails = {
  client?: { name?: string; logo_uri?: string; client_uri?: string };
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[];
};

// Narrow local typing for the beta supabase.auth.oauth namespace.
type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};

function oauth(): OAuthNamespace {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.auth as any).oauth as OAuthNamespace;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Solicitação de autorização inválida (authorization_id ausente).");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauth();
    const { data, error } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou uma URL de redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold mb-2">Não foi possível carregar</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </section>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </main>
    );
  }

  const clientName = details.client?.name ?? "um aplicativo externo";

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold mb-2">Conectar {clientName} à sua conta</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Ao aprovar, {clientName} poderá usar o APE Piteco em seu nome, com os mesmos dados que você acessa.
          Você pode revogar o acesso a qualquer momento nas configurações da sua conta.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end">
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            Recusar
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            Aprovar
          </Button>
        </div>
      </section>
    </main>
  );
}