import { useState } from 'react';
import { Cloud, CloudOff, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useGuestHistory } from '@/hooks/useGuestHistory';
import { useGuestServerSync } from '@/hooks/useGuestServerSync';
import {
  disableAnonymousPortalHistorySync,
  syncAnonymousPortalHistory,
} from '@/lib/portalHistorySync';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

function formatExpiry(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function friendlyError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message || error || '');
  const lower = message.toLowerCase();
  if (lower.includes('anonymous') && lower.includes('disabled')) {
    return 'Os logins anônimos ainda não estão ativados no projeto Supabase.';
  }
  if (lower.includes('anonymous_portal_history') || lower.includes('schema cache')) {
    return 'A migration da Etapa 5 ainda não foi aplicada no banco deste ambiente.';
  }
  return 'Não foi possível sincronizar agora. Seu histórico local continua seguro neste navegador.';
}

export function GuestServerSyncPanel() {
  const { user, isLoading: authLoading } = useAuthUser();
  const { items } = useGuestHistory();
  const syncState = useGuestServerSync();
  const [busyAction, setBusyAction] = useState<'enable' | 'sync' | 'disable' | null>(null);

  if (authLoading || user) return null;

  const enable = async () => {
    setBusyAction('enable');
    try {
      await syncAnonymousPortalHistory(items, { mergeRemote: true });
      toast.success('Backup anônimo ativado!');
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusyAction(null);
    }
  };

  const syncNow = async () => {
    setBusyAction('sync');
    try {
      await syncAnonymousPortalHistory(items);
      toast.success('Histórico sincronizado.');
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusyAction(null);
    }
  };

  const disable = async () => {
    setBusyAction('disable');
    try {
      await disableAnonymousPortalHistorySync({ deleteRemote: true });
      toast.success('Backup anônimo desativado e removido do servidor.');
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusyAction(null);
    }
  };

  const expiry = formatExpiry(syncState.expiresAt);

  return (
    <section aria-labelledby="guest-server-sync-title" className="mb-12">
      <Card className="border-primary/15 bg-card/80 p-5 shadow-sm backdrop-blur sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {syncState.enabled ? <Cloud className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">Opcional</p>
              <h2 id="guest-server-sync-title" className="text-lg font-bold sm:text-xl">
                Backup anônimo do histórico
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {syncState.enabled
                  ? 'Uma sessão anônima isolada mantém uma cópia do histórico no servidor e permite incorporá-la à sua conta quando você entrar.'
                  : 'Ative para manter uma cópia protegida no servidor. O recurso não usa IP, fingerprint, nome, e-mail ou o login principal do aplicativo.'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            {syncState.enabled ? (
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button type="button" variant="outline" size="sm" onClick={syncNow} disabled={busyAction !== null}>
                  {busyAction === 'sync' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Sincronizar agora
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={disable} disabled={busyAction !== null}>
                  {busyAction === 'disable' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Desativar e apagar
                </Button>
              </div>
            ) : (
              <Button type="button" onClick={enable} disabled={busyAction !== null}>
                {busyAction === 'enable' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cloud className="mr-2 h-4 w-4" />}
                Ativar backup anônimo
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-border/60 pt-4 text-sm sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">Acesso protegido pela sessão anônima e pelas regras RLS.</span>
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">Desligado por padrão e ativado somente por decisão do visitante.</span>
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">
              {syncState.enabled && expiry ? `Cópia anônima válida até ${expiry}.` : 'Dados anônimos expiram em até 90 dias.'}
            </span>
          </div>
        </div>

        {syncState.lastError && (
          <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            A última tentativa de sincronização não foi concluída. O histórico local continua funcionando normalmente.
          </p>
        )}
      </Card>
    </section>
  );
}
