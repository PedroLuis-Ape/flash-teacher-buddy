import { Bookmark, Chrome, ExternalLink, MonitorSmartphone, MousePointerClick, RefreshCw, Sparkles } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/seo/PublicNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useBrowserExtensionStatus } from "@/features/browser-extension/useBrowserExtensionStatus";
import { INSTALL_GUIDE_URL, WEB_STORE_URL } from "@/features/browser-extension/extensionConfig";
import type { ExtensionStatus } from "@/features/browser-extension/extensionConfig";

/**
 * Entrada permanente da extensão na navegação pública.
 *
 * O convite automático continua existindo para chamar atenção; esta página
 * garante que o usuário sempre consiga reencontrar a extensão pela navegação,
 * mesmo depois de dispensar o convite ou entrar em snooze.
 *
 * A URL da Chrome Web Store vem SEMPRE de extensionConfig (fonte única).
 */
const STATUS_COPY: Record<ExtensionStatus, { label: string; tone: string }> = {
  installed: { label: "Instalada neste navegador", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  missing: { label: "Não instalada neste navegador", tone: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  unsupported: { label: "Navegador não compatível", tone: "border-border bg-muted text-muted-foreground" },
  unknown: { label: "Verificando neste navegador...", tone: "border-border bg-muted text-muted-foreground" },
};

const STEPS = [
  "Instale a extensão pela Chrome Web Store no computador.",
  "Selecione uma palavra ou frase em qualquer página do navegador.",
  "Ouça a pronúncia ou guarde o trecho para revisar no App Piteco.",
];

const Extension = () => {
  const { status, refresh } = useBrowserExtensionStatus();
  const statusCopy = STATUS_COPY[status];

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <Badge variant="secondary" className="mb-4">Extensão oficial</Badge>
        <h1 className="text-2xl font-extrabold leading-tight sm:text-4xl">
          Extensão APE — Pronúncia e Notas
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Leve o APE para fora do app: selecione uma palavra ou frase em qualquer site,
          ouça a pronúncia e salve o trecho para estudar depois. Nada é instalado sem a sua confirmação.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button asChild className="h-12 min-h-12 rounded-xl px-5 text-base font-semibold">
            <a href={WEB_STORE_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">Instalar pela Chrome Web Store</span>
            </a>
          </Button>
          <Button asChild variant="outline" className="h-12 min-h-12 rounded-xl px-5 font-semibold">
            {/* Guia estático em public/: precisa de <a>, não do roteador SPA. */}
            <a href={INSTALL_GUIDE_URL}>
              <span className="whitespace-nowrap">Ver passo a passo</span>
            </a>
          </Button>
        </div>

        <div className={"mt-5 flex flex-wrap items-center gap-3 rounded-xl border p-3 " + statusCopy.tone}>
          <Chrome className="h-5 w-5 shrink-0" />
          <span className="text-sm font-semibold">{statusCopy.label}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={refresh}
            className="ml-auto h-9 shrink-0 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Verificar de novo
          </Button>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <MousePointerClick className="h-5 w-5 text-primary" />
            <h2 className="mt-2 text-base font-bold">Selecione e ouça</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Marque qualquer trecho em inglês e ouça a pronúncia americana sem sair da página.
            </p>
          </Card>
          <Card className="p-4">
            <Bookmark className="h-5 w-5 text-primary" />
            <h2 className="mt-2 text-base font-bold">Salve nas notas</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Guarde a frase encontrada e revise depois dentro do App Piteco.
            </p>
          </Card>
          <Card className="p-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="mt-2 text-base font-bold">Aprenda no contexto real</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              O vocabulário vem do que você realmente lê no dia a dia.
            </p>
          </Card>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-bold sm:text-xl">Como usar</h2>
          <ol className="mt-3 space-y-2">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <span className="min-w-0">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold sm:text-xl">Navegadores compatíveis</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <Card className="flex-1 p-4">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="h-5 w-5 shrink-0 text-primary" />
                <span className="font-semibold">Computador</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Google Chrome e Microsoft Edge no desktop.
              </p>
            </Card>
            <Card className="flex-1 p-4">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="font-semibold">Celular</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                O Chrome para celular não executa extensões de desktop. No telefone, use o app normalmente.
              </p>
            </Card>
          </div>
        </section>

        <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
          O App Piteco nunca instala a extensão sozinho: o botão abre a Chrome Web Store
          e a confirmação final é sempre sua.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
};

export default Extension;
