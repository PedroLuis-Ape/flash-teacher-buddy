import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: any;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const senderName = message.profiles?.first_name || 'Usuário';
  const avatarUrl = message.profiles?.avatar_skin_id 
    ? `/assets/published/${message.profiles.avatar_skin_id}_avatar.png`
    : null;

  return (
    <div className={cn("flex gap-2 mb-4", isOwn && "flex-row-reverse")}>
      <Avatar className="h-8 w-8 shrink-0">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={senderName} />}
        <AvatarFallback>{senderName[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      
      <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
        <div className={cn(
          "rounded-2xl px-4 py-2 max-w-[70%]",
          isOwn 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted"
        )}>
          {!isOwn && (
            <p className="text-xs font-semibold mb-1 opacity-70">{senderName}</p>
          )}
          <p className="text-sm whitespace-pre-wrap break-words">{message.texto}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(message.created_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </p>
      </div>
    </div>
  );
}