import { lazy, Suspense, type ComponentProps, useCallback, useState } from "react";
import { toast } from "sonner";
import { EditFlashcardDialog } from "@/components/EditFlashcardDialog";
import { useAuthUser } from "@/hooks/useAuthUser";
import { supabase } from "@/integrations/supabase/client";
import { readStudyResumePointer } from "@/features/study/lib/studyResumePointer";

export type { GameSettings } from "./GameSettingsModal.impl";

const LazyGameSettingsModal = lazy(() =>
  import("./GameSettingsModal.impl").then((module) => ({ default: module.GameSettingsModal }))
);

type GameSettingsModalProps = ComponentProps<typeof LazyGameSettingsModal>;

type RuntimeEditableCard = {
  id: string;
  user_id?: string | null;
  list_id?: string | null;
  parent_card_id?: string | null;
  layer_index?: number | null;
  term: string;
  translation: string;
  hint?: string | null;
  image_url_a?: string | null;
  image_url_b?: string | null;
  word_hints?: unknown;
  note_text?: string[] | null;
  short_explanation?: string | null;
  detailed_explanation?: string | null;
  usage_notes?: string | null;
  common_mistakes?: string | null;
};

const EDITABLE_CARD_SELECT = [
  "id",
  "user_id",
  "list_id",
  "parent_card_id",
  "layer_index",
  "term",
  "translation",
  "hint",
  "image_url_a",
  "image_url_b",
  "word_hints",
  "note_text",
  "short_explanation",
  "detailed_explanation",
  "usage_notes",
  "common_mistakes",
].join(",");

async function fetchEditableCard(cardId: string): Promise<RuntimeEditableCard> {
  const { data, error } = await (supabase as any)
    .from("flashcards")
    .select(EDITABLE_CARD_SELECT)
    .eq("id", cardId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("Card atual não encontrado.");
  }

  return data as RuntimeEditableCard;
}

async function resolveVisibleCard(
  cardId: string,
  layerIndex: number | null | undefined,
): Promise<RuntimeEditableCard> {
  const entry = await fetchEditableCard(cardId);
  if (!entry.parent_card_id || layerIndex == null || layerIndex <= 0) return entry;

  const { data, error } = await (supabase as any)
    .from("flashcards")
    .select(EDITABLE_CARD_SELECT)
    .eq("parent_card_id", entry.parent_card_id)
    .is("deleted_at", null)
    .order("layer_index", { ascending: true });

  if (error) throw error;
  const layers = (data ?? []) as RuntimeEditableCard[];
  return layers[layerIndex] ?? entry;
}

async function resolveMatchingSourceLayer(
  sourceCardId: string,
  materializedCard: RuntimeEditableCard,
): Promise<RuntimeEditableCard> {
  const sourceCard = await fetchEditableCard(sourceCardId);
  if (!materializedCard.parent_card_id) return sourceCard;

  const sourceParentId = sourceCard.parent_card_id ?? sourceCard.id;
  const { data, error } = await (supabase as any)
    .from("flashcards")
    .select(EDITABLE_CARD_SELECT)
    .eq("parent_card_id", sourceParentId)
    .is("deleted_at", null)
    .order("layer_index", { ascending: true });

  if (error) throw error;
  const sourceLayers = (data ?? []) as RuntimeEditableCard[];
  if (materializedCard.layer_index != null) {
    const exactLayer = sourceLayers.find((card) => card.layer_index === materializedCard.layer_index);
    if (exactLayer) return exactLayer;
  }

  return sourceCard;
}

async function resolveOriginalCardForNotes(
  userId: string,
  materializedCard: RuntimeEditableCard,
): Promise<RuntimeEditableCard> {
  const materializationGroupId = materializedCard.parent_card_id ?? materializedCard.id;

  const { data: reinforcementPoint, error: reinforcementError } = await (supabase as any)
    .from("user_reinforcement_points")
    .select("source_card_id")
    .eq("user_id", userId)
    .eq("materialization_group_id", materializationGroupId)
    .eq("is_active", true)
    .maybeSingle();

  if (reinforcementError) throw reinforcementError;
  if (reinforcementPoint?.source_card_id) {
    return resolveMatchingSourceLayer(reinforcementPoint.source_card_id, materializedCard);
  }

  // Compatibility for historical attention-point materializations. New
  // attention points no longer create study clones, but old rows can still be
  // present and must resolve back to their original flashcard before editing.
  const { data: attentionPoint, error: attentionError } = await (supabase as any)
    .from("user_special_flashcards")
    .select("flashcard_id")
    .eq("user_id", userId)
    .eq("materialization_group_id", materializationGroupId)
    .eq("is_active", true)
    .maybeSingle();

  if (attentionError) throw attentionError;
  if (attentionPoint?.flashcard_id) {
    return resolveMatchingSourceLayer(attentionPoint.flashcard_id, materializedCard);
  }

  if (!materializedCard.list_id) return materializedCard;

  const { data: list, error: listError } = await (supabase as any)
    .from("lists")
    .select("system_kind")
    .eq("id", materializedCard.list_id)
    .maybeSingle();

  if (listError) throw listError;
  if (list?.system_kind && list.system_kind !== "user") {
    throw new Error("Não foi possível localizar o card original desta revisão.");
  }

  return materializedCard;
}

export const GameSettingsModal = (props: GameSettingsModalProps) => {
  const { user } = useAuthUser();
  const [notesCard, setNotesCard] = useState<RuntimeEditableCard | null>(null);

  const openCurrentCardNotes = useCallback(async () => {
    if (!user?.id) {
      toast.error("Entre na sua conta para anotar este card.");
      return;
    }

    const pointer = readStudyResumePointer(user.id);
    const currentPathname = typeof window === "undefined"
      ? ""
      : window.location.pathname.replace(/\/+$/, "");
    const pointerPathname = pointer?.path?.split("?")[0]?.replace(/\/+$/, "") ?? "";

    if (!pointer?.currentCardId || !currentPathname || pointerPathname !== currentPathname) {
      toast.error("Não foi possível identificar com segurança o card atual.");
      return;
    }

    try {
      const visibleCard = await resolveVisibleCard(pointer.currentCardId, pointer.layerIndex);
      const originalCard = await resolveOriginalCardForNotes(user.id, visibleCard);
      setNotesCard(originalCard);
    } catch (error) {
      console.error("[GameSettingsModal] Falha ao resolver card original para notas:", error);
      const message = error instanceof Error
        ? error.message
        : "Não foi possível abrir o card atual para anotações.";
      toast.error(message);
    }
  }, [user?.id]);

  const fallbackNotesHandler = !props.onEditCurrentCard && user?.id
    ? openCurrentCardNotes
    : undefined;
  const effectiveEditHandler = props.onEditCurrentCard ?? fallbackNotesHandler;
  const effectiveCanEdit = props.onEditCurrentCard
    ? props.canEditCurrentCard
    : Boolean(user?.id);

  return (
    <>
      <Suspense fallback={null}>
        <LazyGameSettingsModal
          {...props}
          onEditCurrentCard={effectiveEditHandler}
          canEditCurrentCard={effectiveCanEdit}
        />
      </Suspense>

      <EditFlashcardDialog
        flashcard={notesCard}
        isOpen={!!notesCard}
        onClose={() => setNotesCard(null)}
        contentMode="notes-only"
      />
    </>
  );
};
