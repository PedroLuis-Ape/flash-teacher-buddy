import { Bell } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useNotifications } from '@/hooks/useNotifications';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { ScrollArea } from './ui/scroll-area';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function NotificationsBadge() {
  const { notifications, unreadCount, markAsRead, loadMore, hasMore, loading } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = (notification: any) => {
    // Marcar como lida
    markAsRead([notification.id]);

    // Navegar para o destino
    if (notification.type === 'dm' && notification.ref_type === 'thread') {
      // Navegar para thread de DM (quando implementarmos a página)
      setOpen(false);
    } else if (notification.type === 'announcement' && notification.ref_type === 'announcement') {
      // Navegar para anúncio
      navigate(`/announcements/${notification.ref_id}`);
      setOpen(false);
    } else if (notification.type === 'comment') {
      // Navegar para comentário
      setOpen(false);
    }
  };

  const handleMarkAllRead = () => {
    markAsRead();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'dm':
        return '💬';
      case 'announcement':
        return '📢';
      case 'comment':
        return '💭';
      default:
        return '🔔';
    }
  };

  const getNotificationText = (notification: any) => {
    switch (notification.type) {
      case 'dm':
        return 'Nova mensagem direta';
      case 'announcement':
        return 'Novo anúncio na turma';
      case 'comment':
        return 'Novo comentário';
      default:
        return 'Nova notificação';
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notificações</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-3 mt-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Bell className="h-12 w-12 mb-4 opacity-50" />
            <p>Nada novo por aqui.</p>
          </div>
        ) : (
          <>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-4"
                onClick={handleMarkAllRead}
              >
                Marcar tudo como lido
              </Button>
            )}

            <ScrollArea className="h-[calc(100vh-12rem)] mt-4">
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      notification.is_read
                        ? 'bg-background hover:bg-accent'
                        : 'bg-primary/5 hover:bg-primary/10 border-primary/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {getNotificationText(notification)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                      {!notification.is_read && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}

                {hasMore && (
                  <Button variant="ghost" className="w-full" onClick={loadMore}>
                    Carregar mais
                  </Button>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
