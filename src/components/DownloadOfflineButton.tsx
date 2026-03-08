import { Button } from "@/components/ui/button";
import { Download, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOffline";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DownloadOfflineButtonProps {
  listId: string;
  className?: string;
}

export function DownloadOfflineButton({ listId, className }: DownloadOfflineButtonProps) {
  const { isAvailable, isDownloading, lastSync, download, remove } = useOfflineStatus(listId);

  if (isAvailable) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="ghost"
          size="sm"
          className="text-green-600 dark:text-green-400 gap-1.5"
          disabled
        >
          <CheckCircle2 className="h-4 w-4" />
          Offline
        </Button>
        {lastSync && (
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale: ptBR })}
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={download} title="Atualizar dados offline">
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={remove} title="Remover offline">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={download}
      disabled={isDownloading}
      className={cn("gap-1.5", className)}
    >
      {isDownloading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isDownloading ? "Baixando..." : "Baixar offline"}
    </Button>
  );
}
