import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, AlertCircle } from "lucide-react";

interface VideoPlayerModalProps {
  videoId: string | null;
  title?: string;
  onClose: () => void;
}

export function VideoPlayerModal({ videoId, title, onClose }: VideoPlayerModalProps) {
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!videoId) return;

    // Update URL with video parameter (no reload)
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('video', videoId);
    window.history.pushState({}, '', currentUrl.toString());

    // Set timeout for load detection
    setIsLoading(true);
    setLoadError(false);
    
    timeoutRef.current = setTimeout(() => {
      if (isLoading) {
        setLoadError(true);
        setIsLoading(false);
      }
    }, 5000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [videoId]);

  const handleClose = () => {
    // Remove video parameter from URL (no reload)
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('video');
    window.history.replaceState({}, '', currentUrl.toString());
    
    onClose();
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setLoadError(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleOpenOnYouTube = () => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
  };

  if (!videoId) return null;

  return (
    <Dialog open={!!videoId} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-4xl w-full p-0 overflow-hidden"
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking on iframe
          if (iframeRef.current?.contains(e.target as Node)) {
            e.preventDefault();
          }
        }}
      >
        {title && (
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        
        <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground">Carregando vídeo...</p>
              </div>
            </div>
          )}
          
          {loadError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted p-6">
              <div className="text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
                <div className="space-y-2">
                  <p className="font-semibold">Erro ao carregar vídeo</p>
                  <p className="text-sm text-muted-foreground">
                    Não foi possível reproduzir o vídeo no momento.
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => window.location.reload()}>
                    Tentar Novamente
                  </Button>
                  <Button variant="outline" onClick={handleOpenOnYouTube}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir no YouTube
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
              title={title || "YouTube video player"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={handleIframeLoad}
              onError={() => {
                setLoadError(true);
                setIsLoading(false);
              }}
            />
          )}
        </div>
        
        <div className="px-6 py-4 flex justify-end gap-2 border-t">
          <Button variant="outline" onClick={handleOpenOnYouTube}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir no YouTube
          </Button>
          <Button onClick={handleClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
