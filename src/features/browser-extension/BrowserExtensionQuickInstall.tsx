import { Headphones, MousePointer2, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";

const INSTALL_GUIDE_URL = "/extensao/index.html";

export function BrowserExtensionQuickInstall() {
  return (
    <aside
      aria-label="Extensão APE Pronúncia e Notas"
      className="fixed bottom-20 right-4 z-40 hidden w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-primary/30 bg-background/95 p-4 shadow-2xl backdrop-blur md:block"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Puzzle className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Ferramenta para navegador</p>
          <h2 className="mt-1 text-lg font-bold">APE Pronúncia e Notas</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Selecione palavras em qualquer site, ouça em inglês americano e salve trechos para revisar.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-2">
          <MousePointer2 className="h-3.5 w-3.5 text-primary" /> Selecionar
        </span>
        <span className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-2">
          <Headphones className="h-3.5 w-3.5 text-primary" /> Ouvir en-US
        </span>
      </div>

      <Button asChild size="lg" className="mt-3 w-full text-base font-bold">
        <a href={INSTALL_GUIDE_URL}>Instalar a extensão</a>
      </Button>
      <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
        Chrome e Edge no computador. O navegador sempre pede uma confirmação final.
      </p>
    </aside>
  );
}
