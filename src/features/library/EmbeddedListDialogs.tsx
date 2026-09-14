import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layers, Link2, Loader2, Trash, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2">
                        <Checkbox
                          checked={selected.includes(list.id)}
                          onCheckedChange={() => toggle(list.id)}
                          aria-label={`Incorporar ${list.title}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{list.title}</span>
                          <span className="block text-xs text-muted-foreground">
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
  const [busy, setBusy] = useState(false);

  const membersQuery = useQuery({
    queryKey: ["embedded-list-members", listId],
    queryFn: () => fetchEmbeddedListMembers(listId),
    enabled: open && Boolean(listId),
  });

  const members = membersQuery.data ?? [];

  const groups = useMemo<SourceGroup[]>(() => {
    const map = new Map<string, SourceGroup>();
    for (const member of members) {
      const key = member.source_list_id ?? "sem-fonte";
      const group = map.get(key) ?? {
        sourceListId: key,
        title: member.source_list_title ?? "Fonte removida",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(85dvh,calc(100svh-1rem))] min-h-0 max-w-2xl flex-col overflow-hidden"
        data-testid="embedded-list-manage-dialog"
      >
        <DialogHeader>
          <DialogTitle>Cards incorporados</DialogTitle>
          <DialogDescription>
            {listTitle} — {members.length} {members.length === 1 ? "card" : "cards"} de {groups.length}{" "}
            {groups.length === 1 ? "fonte" : "fontes"}. Remover daqui não exclui o card original.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {availableSources.length > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-semibold">Incorporar lista</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableSources.map((list) => (
                  <Button
                    key={list.id}
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] justify-start"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const counts = await embedSourceLists(listId, [list.id]);
                        return describeCounts(counts);
                      })
                    }
                  >
                    <Link2 className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{list.title}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {membersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando cards incorporados…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum card incorporado ainda. Use “Incorporar lista” acima.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.sourceListId} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{group.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.members.length} {group.members.length === 1 ? "card" : "cards"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] w-full sm:w-auto"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const result = await unembedSourceList(listId, group.sourceListId);
                        return `${result.removed} cards removidos da lista combinada.`;
                      })
                    }
                  >
                    <Unlink className="mr-2 h-4 w-4" />
                    Remover todos desta fonte
                  </Button>
                </div>

                <ul className="divide-y">
                  {group.members.map((member) => (
                    <li
                      key={member.flashcard_id}
                      className="flex min-h-[44px] items-center gap-3 py-2"
                    >
                      <Checkbox
                        checked={selected.includes(member.flashcard_id)}
                        onCheckedChange={() => toggleSelection(member.flashcard_id)}
                        aria-label={`Selecionar ${member.term ?? "card"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{member.term ?? "(sem termo)"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.translation ?? ""}
                          {member.is_playable ? "" : " • card indisponível"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] shrink-0"
                        disabled={busy}
                        aria-label={`Remover ${member.term ?? "card"} da lista combinada`}
                        onClick={() =>
                          run(async () => {
                            const result = await unembedCards(listId, [member.flashcard_id]);
                            return `${result.removed} card removido da lista combinada.`;
                          })
                        }
                      >
                        <Unlink className="mr-2 h-4 w-4" />
                        Remover
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
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
