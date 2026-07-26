import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  decideAdvance,
  type AdvanceRequest,
  type CardCompletionStatus,
  type StudyFlowMode,
  type StudyRuntimeMode,
} from "@/features/study/lib/advanceGate";
import {
  readStudyFlowMode,
  STUDY_FLOW_MODE_CHANGED_EVENT,
} from "@/features/study/lib/studyFlowModePreference";

export interface AdvanceControllerOptions {
  cardId: string | null | undefined;
  mode: StudyRuntimeMode;
  flowMode?: StudyFlowMode;
  onAdvance: (status: CardCompletionStatus) => void;
  onCancelSkip?: () => void;
}

export interface AdvanceControllerApi {
  status: CardCompletionStatus;
  setStatus: (status: CardCompletionStatus) => void;
  requestAdvance: (request: AdvanceRequest) => void;
  dialog: {
    open: boolean;
    flowMode: StudyFlowMode;
    cancel: () => void;
    classify: (classification: "known" | "unknown") => void;
  };
  isLocked: boolean;
}

export function useAdvanceController(options: AdvanceControllerOptions): AdvanceControllerApi {
  const { cardId, mode, flowMode: flowModeProp, onAdvance, onCancelSkip } = options;

  const [status, setStatusState] = useState<CardCompletionStatus>("unanswered");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [flowMode, setFlowMode] = useState<StudyFlowMode>(
    () => flowModeProp ?? readStudyFlowMode(),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<StudyFlowMode>).detail;
      if (detail === "mastery_rounds" || detail === "continuous") {
        setFlowMode(detail);
      }
    };
    window.addEventListener(STUDY_FLOW_MODE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(STUDY_FLOW_MODE_CHANGED_EVENT, handler);
  }, []);

  const consumedRef = useRef<string | null>(null);
  const attemptIdRef = useRef<string>("");

  useEffect(() => {
    consumedRef.current = null;
    attemptIdRef.current = `${cardId ?? "none"}#${Date.now()}`;
    setStatusState("unanswered");
    setDialogOpen(false);
  }, [cardId]);

  const setStatus = useCallback((next: CardCompletionStatus) => {
    setStatusState(next);
  }, []);

  const emitAdvance = useCallback(
    (final: CardCompletionStatus) => {
      const token = attemptIdRef.current;
      if (consumedRef.current === token) return;
      consumedRef.current = token;
      onAdvance(final);
    },
    [onAdvance],
  );

  const requestAdvance = useCallback(
    (request: AdvanceRequest) => {
      if (consumedRef.current === attemptIdRef.current) return;
      const decision = decideAdvance(status, request, mode);
      if (decision.kind === "advance") {
        emitAdvance(status === "unanswered" ? "skipped" : status);
      } else if (decision.kind === "confirm-skip") {
        setDialogOpen(true);
      }
    },
    [status, mode, emitAdvance],
  );

  const cancel = useCallback(() => {
    setDialogOpen(false);
    onCancelSkip?.();
  }, [onCancelSkip]);

  const classify = useCallback((classification: "known" | "unknown") => {
    setDialogOpen(false);
    const finalStatus = classification === "known" ? "correct" : "skipped";
    setStatusState(finalStatus);
    emitAdvance(finalStatus);
  }, [emitAdvance]);

  const dialog = useMemo(
    () => ({ open: dialogOpen, flowMode, cancel, classify }),
    [dialogOpen, flowMode, cancel, classify],
  );

  return {
    status,
    setStatus,
    requestAdvance,
    dialog,
    isLocked: consumedRef.current === attemptIdRef.current,
  };
}
