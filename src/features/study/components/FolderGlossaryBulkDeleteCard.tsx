import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFolderGlossaryPage } from "@/hooks/useFolderGlossary";
import {
  deleteFolderGlossaryBulk,
  type FolderGlossaryBulkDeleteRequest,
} from "@/features/study/lib/folderGlossaryBulkDeleteApi";
import { publishFolderGlossaryRefresh } from "@/features/study/lib/folderGlossaryRefresh";
import type { GlossarySide } from "@/features/study/lib/folderGlossaryTypes";

interface Props {
  folderId: string;
  folderTitle: string;
  labelA: string;
  labelB: string;
  total: number;
}

interface DeleteIntent {
  request: FolderGlossaryBulkDeleteRequest;
  count: number;
  title: string;
  description: string;
  requiresPhrase: boolean;
}

const PAGE_SIZE = 60;
const SEARCH_DELAY_MS = 300;
const DELETE_ALL_PHRASE = "APAGAR TUDO";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debounced;
}

export function FolderGlossaryBulkDeleteCard({
  folderId,
  folderTitle,
  labelA,
  labelB,
  total: folderTotal,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState<"all" | GlossarySide>("all");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [allResultsSelected, setAllResultsSelected] = useState(false);
  const [deleteIntent, setDeleteIntent] = useState<DeleteIntent | null>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DELAY_MS);

  const {
    entries,
    total,
    isLoading,
    isFetching,
    invalidate,
  } = useFolderGlossaryPage(open ? folderId : undefined, {
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
    side: sideFilter,
  });

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageIds = useMemo(() => entries.map((entry) => entry.id), [entries]);
  const pageSelectedCount = pageIds.filter((id) => selectedIds.has(id)).length;
  const pageAllSelected = entries.length > 0
    && (allResultsSelected || pageSelectedCount === entries.length);
  const pagePartiallySelected = !allResultsSelected
    && pageSelectedCount > 0
    && pageSelectedCount < entries.length;
  const selectedCount = allResultsSelected ? total : selectedIds.size;
  const hasFilter = Boolean(debouncedSearch.trim()) || sideFilter !== "all";

  useEffect(() => {
    setSelectedIds(new Set());
    setAllResultsSelected(false);
    setPage(0);
  }, [debouncedSearch, sideFilter]);

  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);

  const clearSelection = () => {
    setSelectedIds(new Set());
    setAllResultsSelected(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch("");
      setSideFilter("all");
      setPage(0);
      clearSelection();
    }
  };

  const togglePage = () => {
    if (allResultsSelected) {
      clearSelection();
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      const removePage = pageIds.every((id) => next.has(id));
      for (const id of pageIds) {
        if (removePage) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const toggleEntry = (entryId: string) => {
    if (allResultsSelected) {
      setAllResultsSelected(false);
      setSelectedIds(new Set(pageIds.filter((id) => id !== entryId)));
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const requestSelectedDeletion = () => {
    if (selectedCount === 0) return;

    if (allResultsSelected && !hasFilter) {
      setDeleteIntent({
        request: { scope: "all" },
        count: total,
        title: "Apagar o glossário inteiro?",
        description: `Todas as ${total.toLocaleString("pt-BR")} entradas desta pasta serão excluídas permanentemente.`,
        requiresPhrase: true,
      });
      return;
    }

    if (allResultsSelected) {
      setDeleteIntent({
        request: {
          scope: "filter",
          search: debouncedSearch,
          side: sideFilter === "all" ? null : sideFilter,
        },
        count: total,
        title: "Apagar todos os resultados?",
        description: `As ${total.toLocaleString("pt-BR")} entradas que correspondem à busca e ao filtro atuais serão excluídas, inclusive nas outras páginas.`,
        requiresPhrase: false,
      });
      return;
    }

    setDeleteIntent({
      request: { scope: "ids", ids: Array.from(selectedIds) },
      count: selectedIds.size,
      title: "Apagar entradas selecionadas?",
      description: `${selectedIds.size.toLocaleString("pt-BR")} entrada(s) marcada(s) serão excluídas permanentemente.`,
      requiresPhrase: false,
    });
  };

  const requestDeleteAll = () => {
    if (folderTotal === 0) return;
    setDeleteIntent({
      request: { scope: "all" },
      count: folderTotal,
      title: "Apagar o glossário inteiro?",
      description: `Todas as ${folderTotal.toLocaleString("pt-BR")} entradas do glossário de “${folderTitle}” serão excluídas permanentemente.`,
      requiresPhrase: true,
    });
  };

  const deleteMutation = useMutation({
    mutationFn: (request: FolderGlossaryBulkDeleteRequest) =>
      deleteFolderGlossaryBulk(folderId, request),
    onSuccess: async (result) => {
      clearSelection();
      setDeleteIntent(null);
      setConfirmationText("");
      setPage(0);
      await invalidate();
      publishFolderGlossaryRefresh({
        folderId,
        syncedAt: new Date().toISOString(),
        source: "edit",
      });
      toast.success(`${result.deleted.toLocaleString("pt-BR")} entrada(s) apagada(s) do glossário.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confirmDeletion = async () => {
    if (!deleteIntent) return;
    if (deleteIntent.requiresPhrase && confirmationText !== DELETE_ALL_PHRASE) return;
    await deleteMutation.mutateAsync(deleteIntent.request);
  };

  return (
    <>
      <Card className="border-destructive/20 bg-destructive/[0.03]">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="font-medium">Selecionar e apagar termos</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Marque algumas entradas, selecione todos os resultados de uma busca ou apague o glossário inteiro.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(true)}>
              <ListChecks className="mr-2 h-4 w-4" />Selecionar termos
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={requestDeleteAll}
              disabled={folderTotal === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />Apagar tudo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Selecionar termos para exclusão</DialogTitle>
            <DialogDescription>
              A seleção pode atravessar páginas. Você também pode selecionar todos os resultados da busca atual.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar termo, tradução ou nota..."
                className="pl-9"
              />
            </div>
            <Select value={sideFilter} onValueChange={(value) => setSideFilter(value as "all" | GlossarySide)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os lados</SelectItem>
                <SelectItem value="A">{labelA}</SelectItem>
                <SelectItem value="B">{labelB}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={pagePartiallySelected ? "indeterminate" : pageAllSelected}
                  onCheckedChange={togglePage}
                  disabled={entries.length === 0}
                />
                Selecionar página
              </label>
              {pageAllSelected && total > entries.length && !allResultsSelected && (
                <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => {
                  setAllResultsSelected(true);
                  setSelectedIds(new Set());
                }}>
                  Selecionar todos os {total.toLocaleString("pt-BR")} resultados
                </Button>
              )}
              {allResultsSelected && (
                <Badge variant="secondary">
                  Todos os {total.toLocaleString("pt-BR")} resultados selecionados
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedCount > 0 && (
                <>
                  <span className="text-sm font-medium">
                    {selectedCount.toLocaleString("pt-BR")} selecionado(s)
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                    Limpar seleção
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={requestSelectedDeletion}>
                    <Trash2 className="mr-2 h-4 w-4" />Apagar selecionados
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin" />
                Carregando termos...
              </div>
            ) : entries.length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                Nenhum termo encontrado neste filtro.
              </div>
            ) : (
              <div className="divide-y rounded-xl border">
                {entries.map((entry) => {
                  const checked = allResultsSelected || selectedIds.has(entry.id);
                  return (
                    <label
                      key={entry.id}
                      className="flex cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-muted/30"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleEntry(entry.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="break-words">{entry.original_text}</strong>
                          <Badge variant="outline" className="text-[10px]">
                            {entry.side === "A" ? labelA : labelB}
                          </Badge>
                          {!entry.is_active && <Badge variant="secondary">Inativo</Badge>}
                        </div>
                        <p className="mt-1 break-words text-sm font-medium text-primary">
                          {entry.primary_translation}
                        </p>
                        {entry.note && (
                          <p className="mt-1 break-words text-xs text-muted-foreground">{entry.note}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <span className="text-sm text-muted-foreground">
              {total.toLocaleString("pt-BR")} resultado(s)
              {isFetching && !isLoading ? " · atualizando" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                disabled={page === 0 || isFetching}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />Anterior
              </Button>
              <span className="min-w-24 text-center text-sm text-muted-foreground">
                {page + 1} de {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                disabled={page + 1 >= pageCount || isFetching}
              >
                Próxima<ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteIntent)} onOpenChange={(nextOpen) => {
        if (!nextOpen && !deleteMutation.isPending) {
          setDeleteIntent(null);
          setConfirmationText("");
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{deleteIntent?.title}</DialogTitle>
            <DialogDescription>{deleteIntent?.description}</DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Esta ação é permanente. Os termos apagados deixarão de aparecer nos jogos e na auditoria.
          </div>

          {deleteIntent?.requiresPhrase && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Digite <strong>{DELETE_ALL_PHRASE}</strong> para confirmar:
              </p>
              <Input
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                placeholder={DELETE_ALL_PHRASE}
                autoComplete="off"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteIntent(null);
                setConfirmationText("");
              }}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDeletion()}
              disabled={
                deleteMutation.isPending
                || !deleteIntent
                || (deleteIntent.requiresPhrase && confirmationText !== DELETE_ALL_PHRASE)
              }
            >
              {deleteMutation.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Trash2 className="mr-2 h-4 w-4" />}
              {deleteMutation.isPending
                ? "Apagando..."
                : `Apagar ${deleteIntent?.count.toLocaleString("pt-BR") ?? 0} entrada(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
