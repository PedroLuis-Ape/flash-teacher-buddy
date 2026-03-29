import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true // iOS Safari
  );
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Already installed — nothing to show
    if (isStandalone()) {
      console.log('[InstallPWA] App running in standalone mode');
      return;
    }

    // Dismissed this session
    if (sessionStorage.getItem('install-pwa-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      console.log('[InstallPWA] beforeinstallprompt captured');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // iOS fallback: show manual install guide after a short delay
    if (isIOS()) {
      const t = setTimeout(() => {
        if (!isStandalone()) {
          console.log('[InstallPWA] iOS detected, showing manual install guide');
          setShowIOSGuide(true);
          setIsVisible(true);
        }
      }, 3000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[InstallPWA] User choice:', outcome);
    setDeferredPrompt(null);
    setIsVisible(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    sessionStorage.setItem('install-pwa-dismissed', 'true');
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5">
      <div className="bg-card border rounded-lg shadow-lg p-4 flex items-center gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">Instalar o Piteco</h3>
          {showIOSGuide ? (
            <p className="text-xs text-muted-foreground">
              Toque em <Share className="inline w-3 h-3 mx-0.5" /> e depois em
              &quot;Adicionar à Tela Inicial&quot;
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Instale o app para acesso rápido e funcionalidades offline
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!showIOSGuide && (
            <Button size="sm" onClick={handleInstall}>
              <Download className="w-4 h-4 mr-1" />
              Instalar
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
