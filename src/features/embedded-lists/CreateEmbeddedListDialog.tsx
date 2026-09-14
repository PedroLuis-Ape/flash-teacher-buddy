import { useMemo, useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  createEmbeddedList,
  formatEmbeddedMutationMessage,
} from "./embeddedListsService";

export interface EmbeddedSourceListOption {
  id: string;
  title: string;
  card_count?: number;
  is_embedded?: boolean;
}

interface CreateEmbeddedListDialogProps {
  folderId: string;
  lists: EmbeddedSourceListOption[];
  disabled?: boolean;
  onCreated?: (listId: string) => void | Promise<void>;
}

export function CreateEmbeddedListDialog({
  folderId,
  lists,
  disabled = false,
  onCreated,
}: CreateEmbeddedListDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const sourceLists = useMemo(() => lists.filter((list) => !list.is_embedded), [lists]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setSelected(new Set());
  };

  const toggleSource = (listId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(listId)) next.delete(listId);
      else next.add(listId);
      return next;
    });
  };

  const handleCreate = async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      toast.error("Dê um nome para a lista combinada.");
      return;
    }
    if (selected.size === 0) {
      toast.error("Selecione pelo menos uma lista de origem.");
      return;
    }

    setSaving(true);
    try {
      const result = await createEmbeddedList({
        folderId,
        title: normalizedTitle,
        description: description.trim(),
        sourceListIds: Array.from(selected),
      });
      toast.success(`Lista combinada criada. ${formatEmbeddedMutationMessage(result)}`);
      setOpen(false);
      reset();
      await onCreated?.(result.list_id);
    } catch (error: any) {
      console.error("Error creating embedded list:", error);
      toast.error(error?.message || "Não foi possível criar a lista combinada.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && !saving) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled || sourceLists.length === 0} className="min-h-11 gap-2">
          <Link2 className="h-4 w-4" />
          Lista combinada
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Criar lista combinada</DialogTitle>
          <DialogDescription>
            Incorpore cards existentes sem copiá-los. Os cards originais continuam nas listas de origem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden">
          <div className="space-y-2">
            <Label htmlFor="embedded-list-title">Nome</Label>
            <Input
              id="embedded-list-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Revisão geral de inglês"
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="embedded-list-description">Descrição (opcional)</Label>
            <Textarea
              id="embedded-list-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="O que você quer estudar junto?"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Listas de origem</Label>
              <span className="text-xs text-muted-foreground">{selected.size} selecionada(s)</span>
            </div>
            <ScrollArea className="h-64 rounded-xl border">
              <div className="space-y-1 p-2">
                {sourceLists.map((list) => {
                  const checked = selected.has(list.id);
                  return (
                    <label
                      key={list.id}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleSource(list.id)}
                        disabled={saving}
                        aria-label={`Incorporar lista ${list.title}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{list.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {list.card_count ?? 0} {(list.card_count ?? 0) === 1 ? "card" : "cards"}
                        </span>
                      </span>
                    </label>
                  );
                })}
                {sourceLists.length === 0 && (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    Crie uma lista normal com cards antes de montar uma lista combinada.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleCreate} disabled={saving || !title.trim() || selected.size === 0}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            Criar e incorporar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
