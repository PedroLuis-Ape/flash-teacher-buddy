import { useMemo } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface LayeredCardPreviewItem {
  id: string;
  term: string;
  translation: string;
  layer_index?: number | null;
  hint?: string | null;
  example_text?: string | null;
  example_translation?: string | null;
  context_tag?: string | null;
  short_explanation?: string | null;
}

interface LayeredCardPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  layers: LayeredCardPreviewItem[];
  labelA?: string;
  labelB?: string;
}

export function LayeredCardPreviewDialog({
  open,
  onOpenChange,
  title,
  layers,
  labelA = "Lado A",
  labelB = "Lado B",
}: LayeredCardPreviewDialogProps) {
  const orderedLayers = useMemo(
    () => [...layers].sort((a, b) => {
      const left = a.layer_index ?? Number.MAX_SAFE_INTEGER;
      const right = b.layer_index ?? Number.MAX_SAFE_INTEGER;
      return left - right || a.id.localeCompare(b.id);
    }),
    [layers],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2 break-words">
            <Layers className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            {title || "Card em camadas"}
          </DialogTitle>
          <DialogDescription>
            {orderedLayers.length} camada{orderedLayers.length === 1 ? "" : "s"}. Esta janela é somente para visualização; use o botão de lápis do card para editar.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0">
          <div className="space-y-3 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
            {orderedLayers.length === 0 ? (
              <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                Nenhuma camada disponível para este card.
              </div>
            ) : (
              orderedLayers.map((layer, index) => (
                <section
                  key={layer.id}
                  className="space-y-3 rounded-xl border bg-card p-4"
                  aria-labelledby={`preview-layer-${layer.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 id={`preview-layer-${layer.id}`} className="font-semibold">
                      Camada {index + 1}
                    </h3>
                    {layer.context_tag && layer.context_tag !== title ? (
                      <span className="max-w-[50%] truncate rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {layer.context_tag}
                      </span>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0 rounded-lg bg-muted/40 p-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {labelA}
                      </p>
                      <p className="whitespace-pre-wrap break-words text-base">{layer.term}</p>
                    </div>
                    <div className="min-w-0 rounded-lg bg-muted/40 p-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {labelB}
                      </p>
                      <p className="whitespace-pre-wrap break-words text-base">{layer.translation}</p>
                    </div>
                  </div>

                  {(layer.example_text || layer.example_translation) && (
                    <div className="space-y-1 rounded-lg border border-dashed p-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Exemplo
                      </p>
                      {layer.example_text && (
                        <p className="whitespace-pre-wrap break-words">{layer.example_text}</p>
                      )}
                      {layer.example_translation && (
                        <p className="whitespace-pre-wrap break-words text-muted-foreground">
                          {layer.example_translation}
                        </p>
                      )}
                    </div>
                  )}

                  {(layer.short_explanation || layer.hint) && (
                    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {layer.short_explanation || layer.hint}
                    </p>
                  )}
                </section>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 border-t px-5 py-4 sm:px-6">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
