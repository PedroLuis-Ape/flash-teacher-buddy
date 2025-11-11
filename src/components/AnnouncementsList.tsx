import { Card } from './ui/card';
import { Button } from './ui/button';
import { Pin, MessageSquare } from 'lucide-react';
import { Announcement } from '@/hooks/useAnnouncements';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AnnouncementsListProps {
  announcements: Announcement[];
  onAnnouncementClick: (announcement: Announcement) => void;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function AnnouncementsList({
  announcements,
  onAnnouncementClick,
  loading,
  hasMore,
  onLoadMore,
}: AnnouncementsListProps) {
  if (announcements.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
        <p>Sem anúncios ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {announcements.map((announcement) => (
        <Card
          key={announcement.id}
          className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => onAnnouncementClick(announcement)}
        >
          <div className="flex items-start gap-3">
            {announcement.pinned && (
              <Pin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg mb-1 line-clamp-1">{announcement.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {announcement.body}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  {announcement.profiles?.first_name || 'Professor'} •{' '}
                  {formatDistanceToNow(new Date(announcement.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
                {announcement.comment_count !== undefined && announcement.comment_count > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {announcement.comment_count}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}

      {hasMore && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={onLoadMore}
          disabled={loading}
        >
          {loading ? 'Carregando...' : 'Carregar mais'}
        </Button>
      )}
    </div>
  );
}
