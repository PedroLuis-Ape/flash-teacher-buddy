import { lazy, Suspense, type ComponentProps, useCallback, useState } from "react";
import { toast } from "sonner";
import { EditFlashcardDialog } from "@/components/EditFlashcardDialog";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  resolveCurrentSourceCard,
  type RuntimeEditableCard,
} from "@/features/study/lib/studyCardNotesTarget";

export type { GameSettings } from "./GameSettingsModal.impl";

const LazyGameSettingsModal = lazy(() =>
  import("./GameSettingsModal.impl").then((module) => ({ default: module.GameSettingsModal }))
);

type GameSettingsModalProps = ComponentProps<typeof LazyGameSettingsModal>;

export const GameSettingsModal = (props: GameSettingsModalProps) => {
  const { user } = useAuthUser();
  const [notesCard, setNotesCard] = useState<RuntimeEditableCard | null>(null);

  const openCurrentCardNotes = useCallback(async () => {
    if (!user?.id) {
      toast.error("Entre na sua conta para anotar este card.");
      return;
    }

    try {
      // Resolução canônica compartilhada com as anotações do glossário:
      // materialização de Reforço sempre volta para o card original.
      const { sourceCard } = await resolveCurrentSourceCard(
        user.id,
        typeof window === "undefined" ? "" : window.location.pathname,
      );
      setNotesCard(sourceCard);
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

