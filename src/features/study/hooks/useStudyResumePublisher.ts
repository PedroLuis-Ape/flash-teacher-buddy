/**
 * Camada comum de publicação do ponteiro de retomada.
 *
 * Toda superfície que estuda uma lista/coleção precisa publicar a MESMA
 * identidade de sessão (`aperto local` -> `StudyResumeSnapshotV2`). Antes só o
 * Study normal fazia isso; a Prática Mista salvava a sessão durável mas deixava
 * o card da Home apontando para a lista anterior.
 */
import { useCallback, useEffect } from "react";
import { writeStudyResumePointer } from "@/features/study/lib/studyResumePointer";
import type { StudySettingsSnapshotV2 } from "@/features/study/lib/studySettingsSnapshotV2";

export type StudyResumePublisherStorage = Pick<Storage, "setItem" | "removeItem">;

export interface StudyResumePublisherInput {
  userId?: string | null;
  sessionId?: string | null;
  resourceKind: "list" | "collection";
  resourceId?: string | null;
  /** Modo durável da sessão (`study_sessions.mode`), usado para validá-la. */
  gameMode?: string | null;
  institutionId: string | null;
  path?: string | null;
  settingsSummary: StudySettingsSnapshotV2;
  currentIndex: number;
  currentCardId?: string | null;
  layerIndex?: number | null;
  /**
   * O deck já carregou com pelo menos um card jogável?
   *
   * Guarda restaurada em 2026-09-13: sem ela o ponteiro era publicado antes de
   * o deck carregar (currentIndex 0, nenhum card), e o card "Voltar para onde
   * parou" da Home passava a apontar para uma sessão vazia.
   */
  deckReady: boolean;
  /** Rodada/deck encerrado: mantém o ponteiro anterior, nunca republica. */
  finished?: boolean;
}

function resolveDefaultStorage(): StudyResumePublisherStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function useStudyResumePublisher(
  input: StudyResumePublisherInput,
  storage?: StudyResumePublisherStorage | null,
): { publish: () => void } {
  const target = storage === undefined ? resolveDefaultStorage() : storage;
  const {
    userId,
    sessionId,
    resourceKind,
    resourceId,
    gameMode,
    institutionId,
    path,
    settingsSummary,
    currentIndex,
    currentCardId,
    layerIndex,
    deckReady,
  } = input;

  const publish = useCallback(() => {
    if (!target || !userId || !sessionId || !resourceId || !gameMode || !path) return;
    if (!deckReady) return;
    writeStudyResumePointer({
      userId,
      sessionId,
      resourceKind,
      resourceId,
      gameMode,
      institutionId,
      path,
      settingsSummary,
      currentIndex,
      currentCardId: currentCardId ?? null,
      layerIndex: layerIndex ?? null,
    }, target);
  }, [
    currentCardId,
    currentIndex,
    deckReady,
    gameMode,
    institutionId,
    layerIndex,
    path,
    resourceId,
    resourceKind,
    sessionId,
    settingsSummary,
    target,
    userId,
  ]);

  const finished = input.finished === true;
  useEffect(() => {
    if (finished) return;
    publish();
  }, [finished, publish]);

  return { publish };
}
