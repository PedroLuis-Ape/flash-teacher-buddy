import { useCallback, useMemo, useState } from "react";
import { Link2, Loader2, MinusCircle, RotateCcw, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EmbeddedSourceListOption } from "./CreateEmbeddedListDialog";
import {
  clearEmbeddedList,
  embedSourceLists,
  fetchEmbeddedListMembers,
  formatEmbeddedMutationMessage,
  type EmbeddedListMember,
  unembedCards,
  unembedSourceList,
} from "./embeddedListsService";

interface EmbeddedListManagerDialogProps {
  listId: string;
  title: string;
  sourceLists: EmbeddedSourceListOption[];
  onChanged?: () => void | Promise<void>;
  trigger?: React.ReactNode;
}

export function EmbeddedListManagerDialog({
  listId,
  title,
  sourceLists,
  onChanged,
  trigger,
}: EmbeddedListManagerDialogProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<EmbeddedListMember[]>([]);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [sourcesToAdd, setSourcesToAdd] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await fetchEmbeddedListMembers(listId));
      setSelectedCards(new Set());
    } catch (error: any) {
      console.error("Error loading embedded list members:", error);
      toast.error(error?.message || "Não foi possível carregar os cards incorporados.");
    } finally {
      setLoading(false);
    }
  }, [listId]);

  const sourceGroups = useMemo(() => {
    const groups = new Map<string, { title: string; count: number }>();
    for (const member of members) {
      const current = groups.get(member.source_list_id);
      groups.set(member.source_list_id, {
        title: member.source_list_title,
        count: (current?.count ?? 0) + 1,
      });
    }
    return Array.from(groups.entries()).map(([id, value]) => ({ id, ...value }));
  }, [members]);

  const currentSourceIds = useMemo(() => new Set(sourceGroups.map((source) => source.id)), [sourceGroups]);
  const addableSources = useMemo(
    () => sourceLists.filter((source) => !source.is_embedded && source.id !== listId && !currentSourceIds.has(source.id)),
    [currentSourceIds, listId, sourceLists],
  );

  const runMutation = async (operation: () => Promise<{ removed?: number; added?: number; already_present?: number }>) => {
    setMutating(true);
    try {
      const result = await operation();
      toast.success(formatEmbeddedMutationMessage(result));
      setSourcesToAdd(new Set());
      await loadMembers();
      await onChanged?.();
    } catch (error: any) {
      console.error("Embedded-list mutation failed:", error);
      toast.error(error?.message || "Não foi possível atualizar a lista combinada.");
    } finally {
      setMutating(false);
    }
  };

  const toggleCard = (cardId: string) => {
    setSelectedCards((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const toggleSourceToAdd = (sourceId: string) => {
    setSourcesToAdd((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) void loadMembers();
          else {
            setSelectedCards(new Set());
            setSourcesToAdd(new Set());
          }
        }}
      >
        <DialogTrigger asChild>
          {trigger ?? (
            <Button type="button" variant="ghost" size="sm" className="gap-2">
              <Link2 className="h-4 w-4" />
              Gerenciar cards incorporados
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Cards incorporados</DialogTitle>
            <DialogDescription>
              {title} · remover daqui nunca apaga o card original.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 gap-4 md:grid-cols-[0.85fr_1.4fr]">
            <div className="min-h-0 space-y-4">
              <section className="space-y-2 rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Fontes atuais</h3>
                  <Badge variant="secondary">{sourceGroups.length}</Badge>
                </div>
                {sourceGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma fonte com cards ativos.</p>
                ) : (
                  <div className="space-y-2">
                    {sourceGroups.map((source) => (
                      <div key={source.id} className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{source.title}</span>
                          <span className="text-xs text-muted-foreground">{source.count} {source.count === 1 ? "card" : "cards"}</span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={mutating}
                          onClick={() => void runMutation(() => unembedSourceList(listId, source.id))}
                          title={`Remover todos os cards incorporados de ${source.title}`}
                          aria-label={`Remover todos desta fonte: ${source.title}`}
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-2 rounded-xl border p-3">
                <h3 className="text-sm font-semibold">Incorporar outra lista</h3>
                {addableSources.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Todas as listas normais disponíveis já estão representadas.</p>
                ) : (
                  <ScrollArea className="h-44">
                    <div className="space-y-1 pr-3">
                      {addableSources.map((source) => (
                        <label key={source.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-muted/50">
                          <Checkbox
                            checked={sourcesToAdd.has(source.id)}
                            onCheckedChange={() => toggleSourceToAdd(source.id)}
                            disabled={mutating}
                            aria-label={`Incorporar ${source.title}`}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">{source.title}</span>
                          <span className="text-xs text-muted-foreground">{source.card_count ?? 0}</span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={mutating || sourcesToAdd.size === 0}
                  onClick={() => void runMutation(() => embedSourceLists(listId, Array.from(sourcesToAdd)))}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Incorporar selecionadas
                </Button>
              </section>
            </div>

            <section className="flex min-h-0 flex-col rounded-xl border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
                <div>
                  <h3 className="text-sm font-semibold">Cards</h3>
                  <p className="text-xs text-muted-foreground">{members.length} incorporado(s) · {selectedCards.size} selecionado(s)</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={mutating || selectedCards.size === 0}
                  onClick={() => void runMutation(() => unembedCards(listId, Array.from(selectedCards)))}
                >
                  <MinusCircle className="mr-2 h-4 w-4" />
                  Remover selecionados
                </Button>
              </div>
              <ScrollArea className="h-[420px]">
                <div className="space-y-1 p-2">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                    </div>
                  ) : members.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">A lista combinada está vazia.</p>
                  ) : (
                    members.map((member) => (
                      <div key={member.flashcard_id} className="flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                        <Checkbox
                          checked={selectedCards.has(member.flashcard_id)}
                          onCheckedChange={() => toggleCard(member.flashcard_id)}
                          disabled={mutating}
                          aria-label={`Selecionar card ${member.term}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{member.term}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {member.definition} · {member.source_list_title}
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          disabled={mutating}
                          onClick={() => void runMutation(() => unembedCards(listId, [member.flashcard_id]))}
                          title="Remover da lista combinada"
                          aria-label={`Remover ${member.term} da lista combinada`}
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </section>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              disabled={mutating || members.length === 0}
              onClick={() => setClearOpen(true)}
            >
              Esvaziar lista combinada
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={mutating}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Esvaziar a lista combinada?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão removidas apenas as incorporações desta lista. Nenhum flashcard original será apagado ou movido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutating}
              onClick={(event) => {
                event.preventDefault();
                void runMutation(() => clearEmbeddedList(listId)).then(() => setClearOpen(false));
              }}
            >
              Esvaziar incorporações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
