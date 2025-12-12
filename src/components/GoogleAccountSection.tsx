import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useGoogleLinking } from "@/hooks/useGoogleLinking";
import { Chrome, Check, Loader2, Unlink } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function GoogleAccountSection() {
  const {
    isGoogleConnected,
    loading,
    connectGoogle,
    disconnectGoogle,
  } = useGoogleLinking();

  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    await connectGoogle();
    // Redirect will happen, no need to reset state
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    const success = await disconnectGoogle();
    setDisconnecting(false);
    if (success) {
      setShowDisconnectDialog(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Conta & Segurança
        </h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Chrome className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Google</p>
              <p className="text-sm text-muted-foreground">
                {isGoogleConnected ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Conectado
                  </span>
                ) : (
                  "Não conectado"
                )}
              </p>
            </div>
          </div>
          
          {isGoogleConnected ? (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowDisconnectDialog(true)}
              disabled={disconnecting}
              className="gap-2"
            >
              <Unlink className="h-4 w-4" />
              Desconectar
            </Button>
          ) : (
            <Button 
              variant="default" 
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
              className="gap-2"
            >
              <Chrome className="h-4 w-4" />
              {connecting ? "Conectando..." : "Conectar"}
            </Button>
          )}
        </div>
      </Card>

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar Google?</AlertDialogTitle>
            <AlertDialogDescription>
              Você não poderá mais fazer login com sua conta Google. 
              Certifique-se de que ainda tem acesso ao seu email e senha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? "Desconectando..." : "Desconectar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
