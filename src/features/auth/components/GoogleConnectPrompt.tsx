import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGoogleLinking } from "@/hooks/useGoogleLinking";
import { Chrome } from "lucide-react";

export function GoogleConnectPrompt() {
  const {
    shouldShowPrompt,
    promptLoading,
    connectGoogle,
    markPromptAsSeen,
    markDontShowAgain,
  } = useGoogleLinking();

  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Show dialog when prompt should be shown
  useEffect(() => {
    if (!promptLoading && shouldShowPrompt) {
      setOpen(true);
      // Mark as seen immediately when popup opens
      markPromptAsSeen();
    }
  }, [promptLoading, shouldShowPrompt, markPromptAsSeen]);

  const handleConnect = async () => {
    setConnecting(true);
    await connectGoogle();
    // Redirect will happen, no need to close
  };

  const handleLater = () => {
    setOpen(false);
  };

  const handleDontShowAgain = async () => {
    await markDontShowAgain();
    setOpen(false);
  };

  // Don't render anything while loading or if prompt shouldn't show
  if (promptLoading || !shouldShowPrompt) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Chrome className="h-5 w-5 text-primary" />
            Novidade: conecte sua conta Google
          </DialogTitle>
          <DialogDescription className="pt-2">
            Conecte seu Google para entrar mais rápido e recuperar acesso com facilidade.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 pt-4">
          <Button 
            onClick={handleConnect} 
            disabled={connecting}
            className="w-full gap-2"
          >
            <Chrome className="h-4 w-4" />
            {connecting ? "Conectando..." : "Conectar Google"}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleLater}
            className="w-full"
          >
            Agora não
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={handleDontShowAgain}
            className="w-full text-muted-foreground text-sm"
          >
            Não mostrar novamente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
