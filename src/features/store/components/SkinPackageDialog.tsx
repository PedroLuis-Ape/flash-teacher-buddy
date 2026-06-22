import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, ImageIcon, Sparkles, UserRound } from "lucide-react";
import { getRarityColor, getRarityLabel, type SkinItem } from "@/lib/storeEngine";

interface SkinPackageDialogProps {
  skin: SkinItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owned?: boolean;
  actions?: ReactNode;
}

export function SkinPackageDialog({ skin, open, onOpenChange, owned = false, actions }: SkinPackageDialogProps) {
  const items = [
    { label: "Card colecionável", Icon: ImageIcon },
    { label: "Avatar e foto de perfil", Icon: UserRound },
    { label: "Visual para usar como mascote", Icon: Sparkles },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 p-0 sm:left-1/2 sm:top-1/2 sm:h-[min(90dvh,900px)] sm:w-[calc(100vw-3rem)] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border">
        <div className="flex h-full min-h-0 flex-col">
          <header className="border-b bg-background px-4 py-4 pr-12 sm:px-6">
            <DialogHeader className="text-left">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-xl sm:text-2xl">{skin.name}</DialogTitle>
                <Badge variant="outline" className={getRarityColor(skin.rarity)}>{getRarityLabel(skin.rarity)}</Badge>
                {owned && <Badge className="gap-1"><Check className="h-3.5 w-3.5" />Adquirido</Badge>}
              </div>
              <DialogDescription>{skin.description || "Pacote visual para personalizar seu perfil no App Piteco."}</DialogDescription>
            </DialogHeader>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto grid max-w-5xl gap-5 p-4 pb-6 sm:grid-cols-[minmax(260px,0.8fr)_minmax(320px,1.2fr)] sm:gap-8 sm:p-6">
              <div className="mx-auto aspect-[7/10] w-full max-w-[320px] overflow-hidden rounded-2xl border bg-muted shadow-sm sm:sticky sm:top-0 sm:max-w-none sm:self-start">
                <img src={skin.card_final} alt={`Card do pacote ${skin.name}`} className="h-full w-full object-contain p-3 sm:p-4" />
              </div>

              <div className="space-y-5">
                <section className="rounded-2xl border bg-card p-4 sm:p-5">
                  <h3 className="mb-3 font-semibold">O que vem neste pacote</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {items.map(({ label, Icon }) => (
                      <div key={label} className="flex items-center gap-3 rounded-xl bg-muted/45 p-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-background"><Icon className="h-4 w-4 text-primary" /></span>
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="font-semibold">Prévia no perfil</h3>
                  <p className="mb-3 text-sm text-muted-foreground">Uma visualização rápida antes de comprar ou equipar.</p>
                  <div className="flex min-h-48 items-center gap-5 rounded-2xl border bg-gradient-to-br from-primary/15 via-background to-secondary/20 p-5">
                    <div className="min-w-0 flex-1 text-center">
                      <div className="mx-auto h-24 w-24 overflow-hidden rounded-full border-4 border-background bg-muted shadow-lg sm:h-28 sm:w-28">
                        <img src={skin.avatar_final} alt={`Avatar do pacote ${skin.name}`} className="h-full w-full object-cover" />
                      </div>
                      <p className="mt-3 truncate font-bold">Seu perfil</p>
                      <p className="text-xs text-muted-foreground">{skin.name}</p>
                    </div>
                    <div className="w-24 shrink-0 sm:w-32">
                      <div className="aspect-[7/10] overflow-hidden rounded-xl border bg-background/80 shadow-md rotate-2">
                        <img src={skin.card_final} alt="Prévia do mascote" className="h-full w-full object-contain p-1.5" />
                      </div>
                      <p className="mt-2 text-center text-[11px] text-muted-foreground">Mascote</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </main>

          {actions && <footer className="border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6"><div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:justify-end">{actions}</div></footer>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
