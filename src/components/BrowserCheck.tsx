import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function detectBrowser(): { name: string; isSupported: boolean } {
  const ua = navigator.userAgent;
  
  // Check for Chrome (but not Edge which includes Chrome in UA)
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    return { name: 'Chrome', isSupported: true };
  }
  
  // Check for Edge
  if (ua.includes('Edg')) {
    return { name: 'Edge', isSupported: true };
  }
  
  // Check for Safari (but not Chrome-based)
  if (ua.includes('Safari') && !ua.includes('Chrome')) {
    return { name: 'Safari', isSupported: true };
  }
  
  // Check for Firefox
  if (ua.includes('Firefox')) {
    return { name: 'Firefox', isSupported: false };
  }
  
  // Check for Opera
  if (ua.includes('Opera') || ua.includes('OPR')) {
    return { name: 'Opera', isSupported: true };
  }
  
  // Android WebView
  if (ua.includes('wv') || ua.includes('Android')) {
    return { name: 'Android WebView', isSupported: true };
  }
  
  return { name: 'Desconhecido', isSupported: false };
}

export function BrowserCheck() {
  const [showWarning, setShowWarning] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<{ name: string; isSupported: boolean } | null>(null);

  useEffect(() => {
    const info = detectBrowser();
    setBrowserInfo(info);
    
    // Only show warning for unsupported browsers, and only once per session
    const hasSeenWarning = sessionStorage.getItem('browser-warning-seen');
    if (!info.isSupported && !hasSeenWarning) {
      setShowWarning(true);
      sessionStorage.setItem('browser-warning-seen', 'true');
    }
  }, []);

  if (!browserInfo || !showWarning) return null;

  return (
    <Dialog open={showWarning} onOpenChange={setShowWarning}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Navegador não totalmente compatível
          </DialogTitle>
          <DialogDescription className="pt-4 space-y-4">
            <p>
              Você está usando <strong>{browserInfo.name}</strong>. Alguns recursos como 
              reconhecimento de voz podem não funcionar corretamente.
            </p>
            <p>
              Para a melhor experiência, recomendamos usar:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Google Chrome</li>
              <li>Microsoft Edge</li>
              <li>Safari (iOS/macOS)</li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setShowWarning(false)}
          >
            Continuar assim
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={() => window.open('https://www.google.com/chrome/', '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Baixar Chrome
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
