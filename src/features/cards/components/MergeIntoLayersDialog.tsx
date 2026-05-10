import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Layers, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  mergeIntoLayers,
} from "@/features/cards/lib/layeredCards";
import { suggestMainTitle } from "@/features/cards/lib/layeredImport";

export interface MergeCandidate {
  id: string;
  term: string;
  translation: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  candidates: MergeCandidate[];
  onMerged?: () => void;
}

/**
 * Modal that takes N selected cards and merges them as internal layers of a
 * new principal card. Pure UI — all DB work goes through `mergeIntoLayers`.
 */
export const MergeIntoLayersDialog = ({
  open,
  onOpenChange,
  listId,
  candidates,
  onMerged,
}: Props) => {
  const qc = useQueryClient();
  const [order, setOrder] = useState<MergeCandidate[]>([]);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const suggested = useMemo(
    () => suggestMainTitle(candidates.map((c) => c.term)),
    [candidates]
  );

  useEffect(() => {
    if (open) {
      setOrder(candidates);
      setTitle(suggested);
    }
  }, [open, candidates, suggested]);

  const move = (idx: number, delta: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleConfirm = async () => {
    if (savingRef.current) return;
    if (order.length < 2) {
      toast.error("Selecione pelo menos 2 cards");
      return;
    }
    if (!title.trim()) {
      toast.error("Defina um título para o card principal");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }
      await mergeIntoLayers({
        listId,
        userId: user.id,
        cardIds: order.map((c) => c.id),
        title: title.trim(),
      });
      toast.success(`✅ ${order.length} cards mesclados em camadas`);
      qc.invalidateQueries({ queryKey: ["flashcards", listId] });
      qc.invalidateQueries({ queryKey: ["gameshub-list", listId] });
      qc.invalidateQueries({ queryKey: ["study-flashcards", listId] });
      try {
        const { removeOfflineList } = await import("@/lib/offlineStore");
        await removeOfflineList(listId).catch(() => {});
      } catch {
        // Offline cache is best-effort only.
      }
      onMerged?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao mesclar cards");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Mesclar em camadas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto py-2">
          <div className="space-y-2">
            <Label htmlFor="merge-title">Título do card principal</Label>
            <Input
              id="merge-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: get"
            />
            {suggested && suggested !== title && (
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() => setTitle(suggested)}
              >
                Usar sugestão: {suggested}
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label>Ordem das camadas ({order.length})</Label>
            <ul className="space-y-1.5">
              {order.map((c, idx) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2"
                >
                  <span className="text-xs text-muted-foreground w-8 shrink-0">
                    Cam. {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.term}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.translation}
                    </p>
                  </div>
                  <div className="flex flex-col">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Mover camada para cima"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => move(idx, 1)}
                      disabled={idx === order.length - 1}
                      aria-label="Mover camada para baixo"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Cada card selecionado vira uma camada interna. Você pode separar
              novamente depois.
            </p>
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 bg-background pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || order.length < 2}>
            {saving ? "Mesclando..." : `Mesclar ${order.length} cards`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};