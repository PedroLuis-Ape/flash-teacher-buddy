import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, MonitorDown, MoreVertical, Share2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getPWAInstallState,
  requestPWAInstall,
  subscribeToPWAInstall,
  type PWAInstallState,
} from "@/lib/pwaInstall";
import { cn } from "@/lib/utils";

function detectPlatform() {
  if (typeof navigator === "undefined") return "desktop" as const;

  const userAgent = navigator.userAgent;
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  if (/iPad|iPhone|iPod/.test(userAgent) || isIPadOS) return "ios" as const;
  if (/Android/i.test(userAgent)) return "android" as const;
  if (/Macintosh|Mac OS X/i.test(userAgent) && /Safari/i.test(userAgent) && !/Chrome|CriOS|Edg/i.test(userAgent)) {
    return "mac-safari" as const;
  }
  if (/Firefox/i.test(userAgent)) return "firefox" as const;
  return "desktop" as const;
}

interface InstallAppButtonProps {
  className?: string;
  compact?: boolean;
}

export function InstallAppButton({ className, compact = false }: InstallAppButtonProps) {
  const [installState, setInstallState] = useState<PWAInstallState>(getPWAInstallState());
  const [guideOpen, setGuideOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const platform = useMemo(detectPlatform, []);

  useEffect(() => subscribeToPWAInstall(setInstallState), []);

  const handleInstall = async () => {
    if (installState.installed) return;

    setInstalling(true);
    try {
      const result = await requestPWAInstall();
      if (result === "unavailable") setGuideOpen(true);
    } finally {
      setInstalling(false);
    }
  };

  const guide = {
    ios: {
      icon: Share2,
      title: "Instalar no iPhone ou iPad",
      text: "Abra esta página no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.",
      steps: ["Toque no botão Compartilhar", "Escolha “Adicionar à Tela de Início”", "Confirme em “Adicionar”"],
    },
    android: {
      icon: Smartphone,
      title: "Instalar no Android",
      text: "No Chrome, abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.",
      steps: ["Abra o menu ⋮ do Chrome", "Toque em “Instalar aplicativo”", "Confirme a instalação"],
    },
    "mac-safari": {
      icon: MonitorDown,
      title: "Instalar no Mac",
      text: "No Safari, use o menu Arquivo e escolha “Adicionar ao Dock”, quando essa opção estiver disponível.",
      steps: ["Abra o menu Arquivo", "Escolha “Adicionar ao Dock”", "Confirme o nome do aplicativo"],
    },
    firefox: {
      icon: MonitorDown,
      title: "Instalar no computador",
      text: "O Firefox pode não oferecer a instalação automática. Abra o APE no Chrome ou Edge e use a opção “Instalar aplicativo”.",
      steps: ["Abra esta página no Chrome ou Edge", "Use o ícone de instalação na barra de endereço", "Confirme a instalação"],
    },
    desktop: {
      icon: MonitorDown,
      title: "Instalar no computador",
      text: "No Chrome ou Edge, use o ícone de instalação na barra de endereço ou a opção “Instalar aplicativo” no menu.",
      steps: ["Procure o ícone de instalação na barra de endereço", "Ou abra o menu do navegador", "Escolha “Instalar APE”"],
    },
  }[platform];

  const GuideIcon = guide.icon;
  const buttonText = installState.installed ? "Instalado" : installing ? "Abrindo…" : "Instalar app";

  return (
    <>
      <Button
        type="button"
        size="sm"
        disabled={installState.installed || installing}
        onClick={handleInstall}
        className={cn(
          "gap-2 border-0 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 text-white shadow-md shadow-primary/20 hover:brightness-110",
          compact ? "px-2.5" : "px-3.5",
          className,
        )}
        aria-label={installState.installed ? "Aplicativo já instalado" : "Instalar aplicativo APE"}
      >
        {installState.installed ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {compact ? (
          <>
            <span className="sm:hidden">{installState.installed ? "Pronto" : installing ? "Abrindo…" : "Instalar"}</span>
            <span className="hidden sm:inline">{buttonText}</span>
          </>
        ) : (
          <span>{buttonText}</span>
        )}
      </Button>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:mx-0">
              <GuideIcon className="h-6 w-6" />
            </div>
            <DialogTitle>{guide.title}</DialogTitle>
            <DialogDescription>{guide.text}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {guide.steps.map((step, index) => (
              <div key={step} className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </div>
                <div className="flex min-h-7 items-center gap-2 text-sm">
                  {index === 0 && platform === "android" ? <MoreVertical className="h-4 w-4 text-muted-foreground" /> : null}
                  {step}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default InstallAppButton;
