import { Link } from 'react-router-dom';
import { BookOpen, Clock3, FolderOpen, GraduationCap, Play, Trash2, X } from 'lucide-react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useGuestHistory } from '@/hooks/useGuestHistory';
import { requestGuestResume, type GuestHistoryItemType } from '@/lib/guestHistory';
import { GuestServerSyncPanel } from '@/components/portal/GuestServerSyncPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

function itemIcon(type: GuestHistoryItemType) {
  switch (type) {
    case 'teacher': return GraduationCap;
    case 'folder': return FolderOpen;
    case 'study':
    case 'activity': return Play;
    default: return BookOpen;
  }
}

function itemLabel(type: GuestHistoryItemType) {
  switch (type) {
    case 'teacher': return 'Professor';
    case 'folder': return 'Pasta';
    case 'study': return 'Estudo';
    case 'activity': return 'Atividade';
    default: return 'Material';
  }
}

function relativeTime(timestamp: number) {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} dia${days === 1 ? '' : 's'}`;
}

export function GuestContinueSection() {
  const { user, isLoading } = useAuthUser();
  const { items, clear, remove } = useGuestHistory();
  const visibleItems = items.slice(0, 4);

  if (isLoading) return null;

  return (
    <>
      {visibleItems.length > 0 && (
        <section aria-labelledby="guest-continue-title" className="mb-12 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">
                {user ? 'Histórico da sua conta' : 'Seu histórico neste navegador'}
              </p>
              <h2 id="guest-continue-title" className="text-2xl font-bold">
                Continue de onde parou
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {user
                  ? 'Seus acessos públicos recentes são sincronizados com sua conta.'
                  : 'O histórico local funciona sem conta. O backup no servidor é opcional e não usa IP.'}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" className="self-start gap-2 text-muted-foreground" onClick={clear}>
              <Trash2 className="h-4 w-4" />
              Limpar histórico
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {visibleItems.map((item, index) => {
              const Icon = itemIcon(item.type);
              return (
                <Card key={item.id} className="group relative overflow-hidden border-border/70 bg-card/85 p-4 shadow-sm">
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="absolute right-2 top-2 rounded-full p-2 text-muted-foreground opacity-70 transition hover:bg-muted hover:opacity-100"
                    aria-label={`Remover ${item.title} do histórico`}
                    title="Remover do histórico"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="flex gap-3 pr-8">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-[11px]">
                          {itemLabel(item.type)}
                        </Badge>
                        {index === 0 && <Badge variant="outline" className="text-[11px]">Último acesso</Badge>}
                      </div>
                      <h3 className="truncate font-semibold">{item.title}</h3>
                      {item.subtitle && <p className="mt-1 truncate text-sm text-muted-foreground">{item.subtitle}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {relativeTime(item.visitedAt)}
                        </span>
                        {item.progressLabel && <span>{item.progressLabel}</span>}
                      </div>
                    </div>
                  </div>

                  <Button asChild className="mt-4 w-full gap-2" variant={index === 0 ? 'default' : 'outline'}>
                    <Link to={item.path} onClick={() => requestGuestResume(item.path)}>
                      <Play className="h-4 w-4" />
                      {index === 0 ? 'Continuar' : 'Abrir novamente'}
                    </Link>
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <GuestServerSyncPanel />
    </>
  );
}
