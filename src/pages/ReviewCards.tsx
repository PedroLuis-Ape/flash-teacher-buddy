import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Flag, Loader2, Pencil, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  FLASHCARD_REVIEW_REASONS,
  type FlashcardReviewFlag,
  type FlashcardReviewReason,
  reviewFlagKeys,
  useFlashcardReviewFlagDetails,
  useFlashcardReviewFlagMetadataMutation,
  useFlashcardReviewFlagMutation,
} from "@/hooks/useFlashcardReviewFlags";
import { EditFlashcardDialog } from "@/components/EditFlashcardDialog";
import type { WordHint } from "@/features/study/lib/wordHints";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface ReviewFlashcard {
  id: string;
  user_id: string | null;
  list_id: string | null;
  parent_card_id: string | null;
  status_group_uid: string | null;
  term: string;
  translation: string;
  hint: string | null;
  image_url_a: string | null;
  image_url_b: string | null;
  word_hints: unknown;
}

interface ReviewQueueItem {
  flag: FlashcardReviewFlag;
  card: ReviewFlashcard | null;
  listTitle: string | null;
  canEdit: boolean;
}

const reasonLabel = (reason: FlashcardReviewReason | null) =>
  reason ? FLASHCARD_REVIEW_REASONS.find((item) => item.value === reason)?.label ?? reason : null;

function normalizeSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function ReviewMetadataDialog({
  flag,
  userId,
  open,
  onOpenChange,
}: {
  flag: FlashcardReviewFlag | null;
  userId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useFlashcardReviewFlagMetadataMutation(userId);
  const [reason, setReason] = useState<FlashcardReviewReason | "none">("none");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open || !flag) return;
    setReason(flag.reason ?? "none");
    setNote(flag.note ?? "");
  }, [flag, open]);

  const save = async () => {
    if (!flag) return;
    await mutation.mutateAsync({
      flagId: flag.id,
      reason: reason === "none" ? null : reason,
      note: note.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes da revisão</DialogTitle>
          <DialogDescription>
            Isto organiza a fila. Não altera o conteúdo do flashcard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo</label>
            <Select value={reason} onValueChange={(value) => setReason(value as FlashcardReviewReason | "none")}>
              <SelectTrigger>
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {FLASHCARD_REVIEW_REASONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="review-card-note" className="text-sm font-medium">Observação</label>
            <Textarea
              id="review-card-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex.: a tradução não combina com o contexto da frase."
              maxLength={1500}
              className="min-h-28 resize-y"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={mutation.isPending || !flag}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar detalhes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReviewCards() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId, isLoading: authLoading } = useAuthUser();
  const flagsQuery = useFlashcardReviewFlagDetails(userId);
  const resolveMutation = useFlashcardReviewFlagMutation(userId);
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [editingCard, setEditingCard] = useState<ReviewFlashcard | null>(null);
  const [metadataFlag, setMetadataFlag] = useState<FlashcardReviewFlag | null>(null);

  useEffect(() => {
    if (!authLoading && !userId) navigate("/auth", { replace: true });
  }, [authLoading, navigate, userId]);

  const flags = flagsQuery.data ?? [];
  const flagSignature = useMemo(() => flags.map((flag) => flag.flashcard_id).sort().join("|"), [flags]);

  const queueQuery = useQuery({
    queryKey: ["flashcard-review-queue-cards", userId ?? "anon", flagSignature],
    enabled: Boolean(userId) && flags.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<ReviewQueueItem[]> => {
      if (!userId || flags.length === 0) return [];
      const cardIds = Array.from(new Set(flags.map((flag) => flag.flashcard_id)));
      const { data: cardsData, error: cardsError } = await (supabase as any)
        .from("flashcards")
        .select("id,user_id,list_id,parent_card_id,status_group_uid,term,translation,hint,image_url_a,image_url_b,word_hints")
        .in("id", cardIds)
        .is("deleted_at", null);
      if (cardsError) throw cardsError;

      const cards = (cardsData ?? []) as ReviewFlashcard[];
      const cardMap = new Map(cards.map((card) => [card.id, card]));
      const listIds = Array.from(new Set(cards.map((card) => card.list_id).filter((value): value is string => Boolean(value))));

      const listMap = new Map<string, { id: string; title: string; owner_id: string | null; folder_id: string | null }>();
      if (listIds.length > 0) {
        const { data: listsData, error: listsError } = await (supabase as any)
          .from("lists")
          .select("id,title,owner_id,folder_id")
          .in("id", listIds)
          .is("deleted_at", null);
        if (listsError) throw listsError;
        for (const list of listsData ?? []) listMap.set(list.id, list);
      }

      const folderIds = Array.from(new Set(
        [...listMap.values()].map((list) => list.folder_id).filter((value): value is string => Boolean(value)),
      ));
      const folderOwnerMap = new Map<string, string | null>();
      if (folderIds.length > 0) {
        const { data: foldersData, error: foldersError } = await (supabase as any)
          .from("folders")
          .select("id,owner_id")
          .in("id", folderIds)
          .is("deleted_at", null);
        if (foldersError) throw foldersError;
        for (const folder of foldersData ?? []) folderOwnerMap.set(folder.id, folder.owner_id ?? null);
      }

      return flags.map((flag) => {
        const card = cardMap.get(flag.flashcard_id) ?? null;
        const list = card?.list_id ? listMap.get(card.list_id) : undefined;
        const folderOwner = list?.folder_id ? folderOwnerMap.get(list.folder_id) : null;
        const canEdit = Boolean(card && (
          card.user_id === userId
          || list?.owner_id === userId
          || folderOwner === userId
        ));
        return {
          flag,
          card,
          listTitle: list?.title ?? null,
          canEdit,
        };
      });
    },
  });

  const queue = queueQuery.data ?? [];
  const listOptions = useMemo(
    () => Array.from(new Set(queue.map((item) => item.listTitle).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
    [queue],
  );

  const filteredQueue = useMemo(() => {
    const needle = normalizeSearch(search.trim());
    return queue.filter((item) => {
      if (listFilter !== "all" && item.listTitle !== listFilter) return false;
      if (reasonFilter !== "all" && (item.flag.reason ?? "none") !== reasonFilter) return false;
      if (!needle) return true;
      return [
        item.card?.term,
        item.card?.translation,
        item.card?.hint,
        item.listTitle,
        item.flag.note,
        reasonLabel(item.flag.reason),
      ].some((value) => normalizeSearch(value).includes(needle));
    });
  }, [listFilter, queue, reasonFilter, search]);

  const handleSaveCard = async (
    flashcardId: string,
    term: string,
    translation: string,
    hint: string,
    imageUrlA?: string,
    imageUrlB?: string,
    wordHints?: WordHint[],
  ) => {
    try {
      const patch = {
        term,
        translation,
        hint: hint || null,
        image_url_a: imageUrlA || null,
        image_url_b: imageUrlB || null,
        word_hints: wordHints && wordHints.length > 0 ? wordHints : null,
      };
      const { data, error } = await (supabase as any)
        .from("flashcards")
        .update(patch)
        .eq("id", flashcardId)
        .select("id,list_id")
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("Você não possui permissão para editar este card.");

      queryClient.setQueriesData<ReviewQueueItem[]>(
        { queryKey: ["flashcard-review-queue-cards", userId ?? "anon"] },
        (current) => current?.map((item) => item.card?.id === flashcardId
          ? { ...item, card: { ...item.card, ...patch } }
          : item),
      );
      if (data.list_id) {
        void queryClient.invalidateQueries({ queryKey: ["flashcards", data.list_id] });
        void queryClient.invalidateQueries({ queryKey: ["study-flashcards", data.list_id] });
        void queryClient.invalidateQueries({ queryKey: ["gameshub-list", data.list_id] });
      }
      void queryClient.invalidateQueries({ queryKey: ["flashcard-review-queue-cards", userId ?? "anon"] });
      toast.success("Flashcard original atualizado. A revisão continua aberta para você conferir.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar o flashcard.";
      toast.error(message);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setListFilter("all");
    setReasonFilter("all");
  };

  const loading = authLoading || flagsQuery.isLoading || (flags.length > 0 && queueQuery.isLoading);

  return (
    <div className="min-h-screen bg-background px-3 py-5 pb-24 sm:px-6 sm:py-8">
      <Helmet>
        <title>Revisar cards | App Piteco</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500">
            <Flag className="h-5 w-5 fill-current" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold sm:text-3xl">Revisar cards</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Cards que você marcou durante o estudo para conferir e corrigir depois.
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">{flags.length} aberto(s)</Badge>
        </div>

        {loading ? (
          <LoadingSpinner message="Carregando sua fila de revisão..." />
        ) : !flags.length ? (
          <Card className="p-10 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
            <h2 className="font-semibold">Nada pendente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Durante qualquer jogo, use a bandeirinha no canto do card para guardar algo que merece revisão.
            </p>
          </Card>
        ) : (
          <>
            <Card className="mb-4 p-3 sm:p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_190px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar texto, tradução, lista ou observação..."
                    className="pl-9"
                  />
                </div>
                <Select value={listFilter} onValueChange={setListFilter}>
                  <SelectTrigger><SelectValue placeholder="Todas as listas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as listas</SelectItem>
                    {listOptions.map((title) => <SelectItem key={title} value={title}>{title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={reasonFilter} onValueChange={setReasonFilter}>
                  <SelectTrigger><SelectValue placeholder="Todos os motivos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os motivos</SelectItem>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {FLASHCARD_REVIEW_REASONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>{filteredQueue.length} resultado(s)</span>
                {(search || listFilter !== "all" || reasonFilter !== "all") && (
                  <Button variant="ghost" size="sm" className="h-7" onClick={clearFilters}>Limpar filtros</Button>
                )}
              </div>
            </Card>

            <div className="space-y-3">
              {filteredQueue.map((item) => {
                const reason = reasonLabel(item.flag.reason);
                return (
                  <Card key={item.flag.id} className="overflow-hidden p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{item.listTitle ?? "Lista indisponível"}</Badge>
                          {reason && <Badge variant="secondary">{reason}</Badge>}
                          <span>Marcado em {new Date(item.flag.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>

                        {item.card ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            <div className="rounded-xl border bg-muted/20 p-3">
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Lado A</div>
                              <div className="break-words text-sm font-medium">{item.card.term}</div>
                            </div>
                            <div className="rounded-xl border bg-muted/20 p-3">
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Lado B</div>
                              <div className="break-words text-sm font-medium">{item.card.translation}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                            O flashcard original não está mais disponível.
                          </div>
                        )}

                        {item.flag.note && (
                          <p className="mt-3 rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Observação: </span>{item.flag.note}
                          </p>
                        )}
                        {item.card && !item.canEdit && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Você pode manter e classificar este relato, mas não possui permissão para editar o card original.
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 sm:w-44 sm:flex-col">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:w-full"
                          onClick={() => item.card && setEditingCard(item.card)}
                          disabled={!item.card || !item.canEdit}
                        >
                          <Pencil className="mr-1.5 h-4 w-4" />Editar card
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:w-full"
                          onClick={() => setMetadataFlag(item.flag)}
                        >
                          <SlidersHorizontal className="mr-1.5 h-4 w-4" />Detalhes
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 sm:w-full"
                          disabled={resolveMutation.isPending}
                          onClick={() => resolveMutation.mutate({ flashcardId: item.flag.flashcard_id, enabled: false })}
                        >
                          {resolveMutation.isPending
                            ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                          Concluir revisão
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {!filteredQueue.length && (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum card corresponde aos filtros atuais.
                </Card>
              )}
            </div>
          </>
        )}
      </div>

      <EditFlashcardDialog
        flashcard={editingCard}
        isOpen={Boolean(editingCard)}
        onClose={() => setEditingCard(null)}
        onSave={handleSaveCard}
      />

      <ReviewMetadataDialog
        flag={metadataFlag}
        userId={userId}
        open={Boolean(metadataFlag)}
        onOpenChange={(open) => !open && setMetadataFlag(null)}
      />
    </div>
  );
}
