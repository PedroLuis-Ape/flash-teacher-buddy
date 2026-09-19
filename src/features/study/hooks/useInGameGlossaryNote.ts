import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthUser } from "@/hooks/useAuthUser";
import { parseWordHints, type WordHint } from "@/features/study/lib/wordHints";
import { readGlossaryNote, type GlossaryNoteTarget } from "@/features/study/lib/glossaryNote";
import { saveInGameGlossaryNote } from "@/features/study/lib/glossaryNoteApi";
import {
  isOwnedByUser,
  resolveCurrentSourceCard,
  type ResolvedCurrentCard,
} from "@/features/study/lib/studyCardNotesTarget";

export function inGameGlossaryNoteKey(userId: string | undefined, pathname: string) {
  return ["in-game-glossary-note", userId ?? "anon", pathname] as const;
}

/**
 * Uma única consulta por página de estudo resolve o card de origem atual
 * (inclusive quando o visível é uma materialização de Reforço) e diz se o
 * usuário pode anotar. O glossário aberto por qualquer palavra reaproveita a
 * mesma entrada de cache.
 */
export function useInGameGlossaryNote() {
  const { user } = useAuthUser();
  const userId = user?.id;
  const pathname = useLocation().pathname;
  const queryClient = useQueryClient();
  const queryKey = inGameGlossaryNoteKey(userId, pathname);

  const query = useQuery({
    queryKey,
    queryFn: () => resolveCurrentSourceCard(userId as string, pathname),
    enabled: Boolean(userId && pathname),
    staleTime: 30_000,
    retry: false,
  });

  const hints = useMemo<WordHint[]>(
    () => parseWordHints(query.data?.sourceCard.word_hints),
    [query.data],
  );

  const canAnnotate = Boolean(userId && query.data && isOwnedByUser(query.data.sourceCard, userId));

  const mutation = useMutation({
    mutationFn: (input: { target: GlossaryNoteTarget; note: string }) =>
      saveInGameGlossaryNote({
        userId: userId as string,
        pathname,
        target: input.target,
        note: input.note,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData<ResolvedCurrentCard>(queryKey, (previous) => (
        previous
          ? { ...previous, sourceCard: { ...previous.sourceCard, word_hints: result.hints } }
          : previous
      ));
      void queryClient.invalidateQueries({ queryKey: ["in-game-glossary-note", userId ?? "anon"] });
    },
  });

  const readNote = useCallback(
    (target: GlossaryNoteTarget) => readGlossaryNote(hints, target),
    [hints],
  );

  const saveNote = useCallback(
    async (target: GlossaryNoteTarget, note: string) => {
      await mutation.mutateAsync({ target, note });
    },
    [mutation],
  );

  return {
    canAnnotate,
    isResolving: query.isLoading,
    isSaving: mutation.isPending,
    sourceCardId: query.data?.sourceCard.id ?? null,
    readNote,
    saveNote,
  };
}

