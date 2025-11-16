import { useLoading } from '@/contexts/LoadingContext';
import { Loader2 } from 'lucide-react';

export function LoadingOverlay() {
  const { isLoading, loadingMessage } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-card shadow-lg border">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-medium text-foreground">
          {loadingMessage || 'Carregando...'}
        </p>
      </div>
    </div>
  );
}
