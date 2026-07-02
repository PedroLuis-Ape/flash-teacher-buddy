import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gem, Layers, ListPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { useSpecialFlashcards } from "@/hooks/useSpecialFlashcards";
import { useAddListToSpecials } from "@/hooks/useAddListToSpecials";
import { buildListSpecialPlan, type ListSpecialCandidate } from "../lib/listSpecials";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
}

type OwnedList = { id: string; title: string };

export default function AddListToSpecialsDialog({ open, onOpenChange, userId }: Props) {
  const [selectedListId, setSelectedListId] = useState("");
  const addList = useAddListToSpecials();
  const specialQuery = useSpecialFlashcards(userId);

  const listsQuery = useQuery({
    queryKey: ["owned-lists-for-specials", userId],
    queryFn: async (): Promise<OwnedList[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("lists")
        .select("id, title")
        .eq("owner_id", userId)
        .order("title", { ascending: true });
      if (error) throw error;
      return (data as OwnedList[]) ?? [];
    },
    enabled: open && Boolean(userId),
    staleTime: 60_000,
  });

  const cardsQuery = useQuery({
    queryKey: ["list-special-candidates", selectedListId],
    queryFn: async (): Promise<ListSpecialCandidate[]> => {
      if (!selectedListId) return [];
      return fetchAllSupabaseRows<ListSpecialCandidate>((from, to) =>
        (supabase as any)
          .from("flashcards")
          .select("id, parent_card_id, deleted_at")
          .eq("list_id", selectedListId)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      );
    },
    enabled: open && Boolean(selectedListId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) setSelectedListId("");
  }, [open]);

  const plan = useMemo(() => buildListSpecialPlan(cardsQuery.data ?? []), [cardsQuery.data]);
  const specialSet = useMemo(() => new Set(specialQuery.data ?? []), [specialQuery.data]);
  const alreadySpecialCount = useMemo(
    () => plan.eligibleIds.reduce((count, id) => count + (specialSet.has(id) ? 1 : 0), 0),
    [plan.eligibleIds, specialSet],
  );
  const newCount = Math.max(0, plan.eligibleCount - alreadySpecialCount);
  const selectedTitle = listsQuery.data?.find((list) => list.id === selectedListId)?.title ?? "";
  const loadingPlan = cardsQuery.isLoading || cardsQuery.isFetching || specialQuery.isLoading;

  const handleConfirm = () => {
    if (!selectedListId || !cardsQuery.data) return;
    addList.mutate(
      { listId: selectedListId, cards: cardsQuery.data },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !addList.isPending && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-sky-600" />
            Adicionar lista inteira aos especiais
          </DialogTitle>
          <DialogDescription>
            Cards comuns entram uma vez. Em cards com camadas, todas as camadas entram separadamente e o agregador técnico é ignorado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Select value={selectedListId} onValueChange={setSelectedListId} disabled={addList.isPending}>
            <SelectTrigger>
              <SelectValue placeholder={listsQuery.isLoading ? "Carregando listas..." : "Escolha uma lista"} />
            </SelectTrigger>
            <SelectContent>
              {(listsQuery.data ?? []).map((list) => (
                <SelectItem key={list.id} value={list.id}>{list.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!listsQuery.isLoading && (listsQuery.data?.length ?? 0) === 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              Nenhuma lista própria foi encontrada nesta conta.
            </div>
          )}

          {selectedListId && (
            <div className="rounded-xl border bg-muted/30 p-4">
              {loadingPlan ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Analisando cards e camadas...
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="font-semibold">{selectedTitle}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-background p-3">
                      <div className="text-xs text-muted-foreground">Cards comuns</div>
                      <div className="text-lg font-bold">{plan.standaloneCount}</div>
                    </div>
                    <div className="rounded-lg bg-background p-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><Layers className="h-3 w-3" />Camadas</div>
                      <div className="text-lg font-bold">{plan.layerCount}</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/20">
                    <div><strong>{plan.eligibleCount}</strong> itens estudáveis encontrados.</div>
                    <div><strong>{alreadySpecialCount}</strong> já estão nos especiais.</div>
                    <div className="mt-1 flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-300">
                      <Gem className="h-4 w-4" /> {newCount} novos itens serão adicionados.
                    </div>
                  </div>
                  {plan.aggregatorCount > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {plan.aggregatorCount} agregador(es) técnico(s) de camadas serão ignorados corretamente.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={addList.isPending}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedListId || loadingPlan || plan.eligibleCount === 0 || addList.isPending}
          >
            {addList.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gem className="mr-2 h-4 w-4" />}
            {addList.isPending ? "Adicionando..." : newCount === 0 ? "Tudo já está na caixa" : `Adicionar ${newCount}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
