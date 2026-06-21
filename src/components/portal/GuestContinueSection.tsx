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
        <section aria-labelledby="guest-continue-title" className="mb-7 space-y-3 sm:mb-12 sm:space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-primary sm:text-sm">
                {user ? 'Histórico da sua conta' : 'Histórico deste navegador'}
              </p>
              <h2 id="guest-continue-title" className="text-xl font-bold sm:text-2xl">
                Continue de onde parou
              </h2>
              <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                {user
                  ? 'Seus acessos públicos recentes são sincronizados com sua conta.'
                  : 'O histórico local funciona sem conta. O backup no servidor é opcional e não usa IP.'}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground sm:h-9 sm:px-3" onClick={clear}>
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Limpar
            </Button>
          </div>

          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
            {visibleItems.map((item, index) => {
              const Icon = itemIcon(item.type);
              return (
                <Card key={item.id} className="group relative min-w-[78vw] snap-center overflow-hidden border-border/70 bg-card/85 p-3 shadow-sm md:min-w-0 md:p-4">
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="absolute right-1.5 top-1.5 rounded-full p-1.5 text-muted-foreground opacity-70 transition hover:bg-muted hover:opacity-100 sm:right-2 sm:top-2 sm:p-2"
                    aria-label={`Remover ${item.title} do histórico`}
                    title="Remover do histórico"
                  >
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>

                  <div className="flex gap-2.5 pr-7 sm:gap-3 sm:pr-8">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
                      <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex flex-wrap items-center gap-1.5 sm:mb-1 sm:gap-2">
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] sm:text-[11px]">
                          {itemLabel(item.type)}
                        </Badge>
                        {index === 0 && <Badge variant="outline" className="px-1.5 py-0 text-[10px] sm:text-[11px]">Último acesso</Badge>}
                      </div>
                      <h3 className="truncate text-sm font-semibold sm:text-base">{item.title}</h3>
                      {item.subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground sm:mt-1 sm:text-sm">{item.subtitle}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground sm:mt-2 sm:gap-x-3 sm:text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          {relativeTime(item.visitedAt)}
                        </span>
                        {item.progressLabel && <span>{item.progressLabel}</span>}
                      </div>
                    </div>
                  </div>

                  <Button asChild className="mt-3 h-9 w-full gap-1.5 text-sm sm:mt-4 sm:h-10 sm:gap-2" variant={index === 0 ? 'default' : 'outline'}>
                    <Link to={item.path} onClick={() => requestGuestResume(item.path)}>
                      <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      {index === 0 ? 'Continuar' : 'Abrir novamente'}
                    </Link>
                  </Button>
                </Card>
              );
            })}
          </div>
          <p className="text-center text-[10px] text-muted-foreground md:hidden">Deslize para ver o histórico recente →</p>
        </section>
      )}

      <GuestServerSyncPanel />
    </>
  );
}
