import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  decideAdvance,
  type AdvanceRequest,
  type CardCompletionStatus,
  type StudyFlowMode,
  type StudyRuntimeMode,
} from "@/features/study/lib/advanceGate";

export interface AdvanceControllerOptions {
  cardId: string | null | undefined;
  mode: StudyRuntimeMode;
  flowMode: StudyFlowMode;
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
    confirm: () => void;
  };
  isLocked: boolean;
}

export function useAdvanceController(options: AdvanceControllerOptions): AdvanceControllerApi {
  const { cardId, mode, flowMode, onAdvance, onCancelSkip } = options;

  const [status, setStatusState] = useState<CardCompletionStatus>("unanswered");
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const confirm = useCallback(() => {
    setDialogOpen(false);
    setStatusState("skipped");
    emitAdvance("skipped");
  }, [emitAdvance]);

  const dialog = useMemo(
    () => ({ open: dialogOpen, flowMode, cancel, confirm }),
    [dialogOpen, flowMode, cancel, confirm],
  );

  return {
    status,
    setStatus,
    requestAdvance,
    dialog,
    isLocked: consumedRef.current === attemptIdRef.current,
  };
}