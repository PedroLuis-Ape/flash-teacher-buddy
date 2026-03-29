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

/** Feature-based capability detection instead of UA-string guessing */
interface BrowserCapabilities {
  speechRecognition: boolean;
  speechSynthesis: boolean;
  serviceWorker: boolean;
  installPrompt: boolean; // will be updated async
  touchEvents: boolean;
  mediaDevices: boolean;
}

function detectCapabilities(): BrowserCapabilities {
  const w = typeof window !== 'undefined' ? window : undefined;
  return {
    speechRecognition: !!(w && ((w as any).SpeechRecognition || (w as any).webkitSpeechRecognition)),
    speechSynthesis: !!(w && w.speechSynthesis),
    serviceWorker: !!(w && 'serviceWorker' in navigator),
    installPrompt: false, // set later by beforeinstallprompt
    touchEvents: !!(w && ('ontouchstart' in w || navigator.maxTouchPoints > 0)),
    mediaDevices: !!(w && navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
  };
}

function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Desconhecido';
}

export function BrowserCheck() {
  const [showWarning, setShowWarning] = useState(false);
  const [missingFeatures, setMissingFeatures] = useState<string[]>([]);
  const [browserName, setBrowserName] = useState('');

  useEffect(() => {
    const hasSeenWarning = sessionStorage.getItem('browser-warning-seen');
    if (hasSeenWarning) return;

    const caps = detectCapabilities();
    const name = getBrowserName();
    setBrowserName(name);

    const missing: string[] = [];
    if (!caps.speechRecognition) missing.push('Reconhecimento de voz');
    if (!caps.speechSynthesis) missing.push('Síntese de voz (TTS)');
    if (!caps.mediaDevices) missing.push('Acesso ao microfone');

    // Log capabilities for diagnostics
    console.log('[BrowserCheck] Browser:', name, '| Capabilities:', caps);
    if (missing.length > 0) {
      console.warn('[BrowserCheck] Missing features:', missing.join(', '));
    }

    // Only show if critical features are missing
    if (missing.length > 0) {
      setMissingFeatures(missing);
      setShowWarning(true);
      sessionStorage.setItem('browser-warning-seen', 'true');
    }
  }, []);

  if (!showWarning) return null;

  return (
    <Dialog open={showWarning} onOpenChange={setShowWarning}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Recursos limitados neste navegador
          </DialogTitle>
          <DialogDescription className="pt-4 space-y-4">
            <p>
              Você está usando <strong>{browserName}</strong>. Os seguintes recursos
              podem não funcionar corretamente:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {missingFeatures.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Para a melhor experiência, recomendamos Google Chrome, Microsoft Edge ou Safari.
            </p>
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
