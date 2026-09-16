/**
 * Camada comum de publicação da ÚLTIMA INTERAÇÃO REAL do usuário.
 *
 * Toda superfície que estuda uma lista/coleção publica a MESMA identidade de
 * atividade: sessão + recurso + modo + card/índice + camada. A publicação vai
 * para duas camadas:
 *
 * - local (`StudyResumeSnapshotV2`): resposta imediata no próprio aparelho;
 * - remota (`touch_study_session_activity_v1`): autoridade durável, cross-device.
 *
 * REGRA P0: só publica quando a IDENTIDADE DE ATIVIDADE muda (sessão, deck
 * atual, card/índice ou camada) ou quando alguém pede explicitamente
 * (`publish()`, ex.: "Salvar e sair"). Rerender técnico, mudança de settings,
 * cache e reconciliação não são atividade e não podem mover o ponteiro.
 */
import { useCallback, useEffect, useRef } from "react";
import { writeStudyResumePointer } from "@/features/study/lib/studyResumePointer";
import { touchStudySessionActivity } from "@/features/study/lib/studySessionActivity";
import { setCurrentStudyCardIdentity } from "@/features/study/lib/currentStudyCardIdentity";
import type { StudySettingsSnapshotV3 } from "@/features/study/lib/studySettingsSnapshotV3";

export type StudyResumePublisherStorage = Pick<Storage, "setItem" | "removeItem">;

export type StudyResumeActivityTouch = (input: {
  sessionId: string;
  revision: number;
  cardId?: string | null;
  cardIndex?: number | null;
  layerIndex?: number | null;
}) => void | Promise<unknown>;

export interface StudyResumePublisherInput {
  userId?: string | null;
  sessionId?: string | null;
  resourceKind: "list" | "collection";
  resourceId?: string | null;
  /** Modo durável da sessão (`study_sessions.mode`), usado para validá-la. */
  gameMode?: string | null;
  institutionId: string | null;
  path?: string | null;
  settingsSummary: StudySettingsSnapshotV3;
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
  /** Injetável em teste; produção usa o RPC de atividade. */
  touchActivity?: StudyResumeActivityTouch;
}

function resolveDefaultStorage(): StudyResumePublisherStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function defaultTouch(input: Parameters<StudyResumeActivityTouch>[0]): void {
  void touchStudySessionActivity(input);
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
    touchActivity,
  } = input;

  const lastRevisionRef = useRef(0);

  const publish = useCallback(() => {
    // UI-local identity is intentionally independent from persistence. It lets
    // subscribers reset transient per-card state as soon as the playable card
    // or visible layer changes, even when the persisted note fields are equal.
    setCurrentStudyCardIdentity(currentCardId, layerIndex);

    if (!target || !userId || !sessionId || !resourceId || !gameMode || !path) return;
    if (!deckReady) return;

    // Revisão monotônica: uma resposta atrasada do card anterior nunca pode
    // voltar o ponteiro (local ou remoto) para trás.
    const revision = Math.max(Date.now(), lastRevisionRef.current + 1);
    lastRevisionRef.current = revision;

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
      activityRevision: revision,
    }, target);

    const touch = touchActivity ?? defaultTouch;
    void touch({
      sessionId,
      revision,
      cardId: currentCardId ?? null,
      cardIndex: currentIndex,
      layerIndex: layerIndex ?? null,
    });
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
    touchActivity,
    userId,
  ]);

  const finished = input.finished === true;
  // Identidade de ATIVIDADE. Settings/cache/rerender ficam de fora de propósito.
  const activityKey = [
    userId ?? "",
    sessionId ?? "",
    resourceKind,
    resourceId ?? "",
    gameMode ?? "",
    deckReady ? "ready" : "loading",
    String(currentIndex),
    currentCardId ?? "",
    layerIndex === null || layerIndex === undefined ? "" : String(layerIndex),
  ].join("|");
  const publishedKeyRef = useRef<string | null>(null);
  const publishRef = useRef(publish);
  publishRef.current = publish;

  useEffect(() => {
    if (finished) return;
    if (publishedKeyRef.current === activityKey) return;
    publishedKeyRef.current = activityKey;
    publishRef.current();
  }, [activityKey, finished]);

  return { publish };
}
