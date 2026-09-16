import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Layers, Link2, ListTree, Loader2, Trash, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  clearEmbeddedList,
  createEmbeddedList,
  embedSourceLists,
  fetchEmbeddedListMembers,
  unembedCards,
  unembedSourceList,
  type EmbeddedListMember,
} from "./embeddedLists";

export interface EmbeddedListSourceOption {
  id: string;
  title: string;
  card_count?: number;
  is_embedded?: boolean;
}

function describeCounts(counts: { requested: number; added: number; already_present: number }): string {
  return `${counts.added} incorporados de ${counts.requested} (${counts.already_present} já estavam na lista)`;
}

/** Criação de lista combinada: título, descrição e listas de origem da pasta. */
export function EmbeddedListCreateDialog({
  folderId,
  sourceLists,
  open,
  onOpenChange,
  onCreated,
}: {
  folderId: string;
  sourceLists: EmbeddedListSourceOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (listId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () => sourceLists.filter((list) => !list.is_embedded),
    [sourceLists],
  );

  const reset = () => {
    setTitle("");
    setDescription("");
    setSelected([]);
  };

  const toggle = (listId: string) => {
    setSelected((current) =>
      current.includes(listId) ? current.filter((id) => id !== listId) : [...current, listId],
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Informe um título para a lista combinada.");
      return;
    }
    if (selected.length === 0) {
      toast.error("Selecione pelo menos uma lista de origem.");
      return;
    }
    setSaving(true);
    try {
      const result = await createEmbeddedList({
        folderId,
        title: title.trim(),
        description: description.trim() || null,
        sourceListIds: selected,
      });
      toast.success(`Lista combinada criada: ${describeCounts(result)}.`);
      reset();
      onOpenChange(false);
      onCreated(result.list_id);
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível criar a lista combinada.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="flex max-h-[min(85dvh,calc(100svh-1rem))] min-h-0 max-w-lg flex-col overflow-hidden"
        data-testid="embedded-list-create-dialog"
      >
        <DialogHeader>
          <DialogTitle>Nova lista combinada</DialogTitle>
          <DialogDescription>
            Os cards continuam nas listas originais. A lista combinada apenas os reúne por referência.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="embedded-title">Título</Label>
            <Input
              id="embedded-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Revisão geral da unidade 1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="embedded-description">Descrição (opcional)</Label>
            <Textarea
              id="embedded-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Listas de origem desta pasta</Label>
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta pasta ainda não tem listas normais para combinar.
              </p>
            ) : (
              <ScrollArea className="max-h-56 rounded-lg border">
                <ul className="divide-y">
                  {options.map((list) => (
                    <li key={list.id}>
                      <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-3 py-2.5">
                        <Checkbox
                          checked={selected.includes(list.id)}
                          onCheckedChange={() => toggle(list.id)}
                          aria-label={`Incorporar ${list.title}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block whitespace-normal break-words text-sm font-medium leading-snug">
                            {list.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {list.card_count ?? 0} {list.card_count === 1 ? "card" : "cards"}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layers className="mr-2 h-4 w-4" />}
            Criar lista combinada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SourceGroup {
  sourceListId: string;
  title: string;
  referenceId: string | null;
  members: EmbeddedListMember[];
}

/** Gerenciamento reversível: nada aqui exclui o card original. */
export function EmbeddedListManageDialog({
  listId,
  listTitle,
  folderLists,
  open,
  onOpenChange,
  onChanged,
}: {
  listId: string;
  listTitle: string;
  folderLists: EmbeddedListSourceOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [expandedSources, setExpandedSources] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const membersQuery = useQuery({
    queryKey: ["embedded-list-members", listId],
    queryFn: () => fetchEmbeddedListMembers(listId),
    enabled: open && Boolean(listId),
  });

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);

  const groups = useMemo<SourceGroup[]>(() => {
    const map = new Map<string, SourceGroup>();
    for (const member of members) {
      const key = member.source_list_id ?? "sem-fonte";
      const group = map.get(key) ?? {
        sourceListId: key,
        title: member.source_list_title ?? "Fonte removida",
        referenceId: member.source_reference_id ?? null,
        members: [],
      };
      group.members.push(member);
      map.set(key, group);
    }
    return [...map.values()];
  }, [members]);

  const availableSources = useMemo(
    () =>
      folderLists.filter(
        (list) =>
          list.id !== listId
          && !list.is_embedded
          && !groups.some((group) => group.sourceListId === list.id),
      ),
    [folderLists, groups, listId],
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["embedded-list-members", listId] });
    onChanged();
  };

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      const message = await action();
      toast.success(message);
      setSelected([]);
      await refresh();
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  };

  const toggleSelection = (flashcardId: string) => {
    setSelected((current) =>
      current.includes(flashcardId)
        ? current.filter((id) => id !== flashcardId)
        : [...current, flashcardId],
    );
  };

  const setSourceExpanded = (sourceListId: string, expanded: boolean) => {
    setExpandedSources((current) => {
      if (expanded) return current.includes(sourceListId) ? current : [...current, sourceListId];
      return current.filter((id) => id !== sourceListId);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90dvh,calc(100svh-0.75rem))] min-h-0 w-[calc(100vw-1rem)] max-w-2xl flex-col overflow-hidden p-4 sm:w-full sm:p-6"
        data-testid="embedded-list-manage-dialog"
      >
        <DialogHeader className="shrink-0 pr-7">
          <DialogTitle>Lista combinada</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{listTitle}</span>
            {" — "}{members.length} {members.length === 1 ? "card" : "cards"} de {groups.length}{" "}
            {groups.length === 1 ? "lista de origem" : "listas de origem"}.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
          {availableSources.length > 0 && (
            <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
              <div>
                <p className="text-sm font-semibold">Adicionar lista de origem</p>
                <p className="text-xs text-muted-foreground">
                  Adicione outra lista da mesma pasta sem copiar os cards.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableSources.map((list) => (
                  <Button
                    key={list.id}
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-[52px] min-w-0 justify-start gap-2 whitespace-normal px-3 py-2 text-left"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const counts = await embedSourceLists(listId, [list.id]);
                        return describeCounts(counts);
                      })
                    }
                  >
                    <Link2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block break-words leading-snug">{list.title}</span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {list.card_count ?? 0} {list.card_count === 1 ? "card" : "cards"}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {membersQuery.isLoading ? (
            <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <p className="text-sm text-muted-foreground">Carregando listas de origem…</p>
            </div>
          ) : membersQuery.isError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
              Não foi possível carregar todas as listas de origem. Tente abrir novamente.
            </div>
          ) : members.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Nenhum card incorporado ainda. Use “Adicionar lista de origem” acima.
            </p>
          ) : (
            <section className="space-y-2" aria-labelledby="embedded-source-lists-title">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 id="embedded-source-lists-title" className="text-sm font-semibold">
                    Listas de origem
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Todas as fontes ficam visíveis; abra uma delas somente quando quiser gerenciar seus cards.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {groups.length}
                </span>
              </div>

              <div className="space-y-2" data-testid="embedded-source-list-groups">
                {groups.map((group) => {
                  const isExpanded = expandedSources.includes(group.sourceListId);
                  const canRemoveWholeSource = group.sourceListId !== "sem-fonte";

                  return (
                    <Collapsible
                      key={group.sourceListId}
                      open={isExpanded}
                      onOpenChange={(next) => setSourceExpanded(group.sourceListId, next)}
                    >
                      <div className="overflow-hidden rounded-xl border bg-card/70 shadow-sm">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-auto min-h-[64px] w-full min-w-0 justify-start gap-3 rounded-none px-3 py-2.5 text-left hover:bg-muted/50"
                            aria-label={`${isExpanded ? "Fechar" : "Abrir"} lista de origem ${group.title}`}
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-primary/5 text-primary">
                              <ListTree className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 block whitespace-normal break-words text-sm font-semibold leading-snug">
                                {group.title}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-normal text-muted-foreground">
                                <span>{group.members.length} {group.members.length === 1 ? "card" : "cards"}</span>
                                {group.referenceId && <span>{group.referenceId}</span>}
                              </span>
                            </span>
                            <ChevronDown
                              className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              aria-hidden="true"
                            />
                          </Button>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="border-t bg-muted/15">
                            <div className="flex flex-col gap-2 border-b px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Cards desta origem
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Marque cards específicos ou remova a fonte inteira.
                                </p>
                              </div>
                              {canRemoveWholeSource && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="min-h-[44px] w-full shrink-0 sm:w-auto"
                                  disabled={busy}
                                  onClick={() =>
                                    run(async () => {
                                      const result = await unembedSourceList(listId, group.sourceListId);
                                      return `${result.removed} cards removidos da lista combinada.`;
                                    })
                                  }
                                >
                                  <Unlink className="mr-2 h-4 w-4" />
                                  Remover esta fonte
                                </Button>
                              )}
                            </div>

                            <ul className="max-h-72 divide-y overflow-y-auto overscroll-contain px-2 sm:px-3">
                              {group.members.map((member) => (
                                <li
                                  key={member.flashcard_id}
                                  className="flex min-h-[56px] items-center gap-2 py-2"
                                >
                                  <Checkbox
                                    checked={selected.includes(member.flashcard_id)}
                                    onCheckedChange={() => toggleSelection(member.flashcard_id)}
                                    aria-label={`Selecionar ${member.term ?? "card"}`}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="line-clamp-2 break-words text-sm font-medium leading-snug">
                                      {member.term ?? "(sem termo)"}
                                    </p>
                                    <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">
                                      {member.translation ?? ""}
                                      {member.is_playable ? "" : " • card indisponível"}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="min-h-[44px] min-w-[44px] shrink-0 px-2 sm:px-3"
                                    disabled={busy}
                                    aria-label={`Remover ${member.term ?? "card"} da lista combinada`}
                                    onClick={() =>
                                      run(async () => {
                                        const result = await unembedCards(listId, [member.flashcard_id]);
                                        return `${result.removed} card removido da lista combinada.`;
                                      })
                                    }
                                  >
                                    <Unlink className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Remover</span>
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t pt-3 sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            className="min-h-[44px] w-full sm:w-auto"
            disabled={busy || selected.length === 0}
            onClick={() =>
              run(async () => {
                const result = await unembedCards(listId, selected);
                return `${result.removed} cards removidos da lista combinada.`;
              })
            }
          >
            <Unlink className="mr-2 h-4 w-4" />
            Remover selecionados ({selected.length})
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="min-h-[44px] w-full sm:w-auto"
                disabled={busy || members.length === 0}
              >
                <Trash className="mr-2 h-4 w-4" />
                Esvaziar lista combinada
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Esvaziar lista combinada?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todas as referências desta lista combinada serão removidas. Os cards originais
                  continuam nas listas de origem, intactos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    run(async () => {
                      const result = await clearEmbeddedList(listId);
                      return `${result.removed} referências removidas.`;
                    })
                  }
                >
                  Esvaziar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
