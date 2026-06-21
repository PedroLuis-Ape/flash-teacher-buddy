import { useCallback, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { audioExtension } from "./audioMime";
import { useAudioRecorder, type AudioRecording } from "./useAudioRecorder";
import type { NormalizedPronunciationResult } from "./types";

export type PronunciationEngineState =
  | "idle"
  | "requesting-permission"
  | "ready"
  | "recording"
  | "processing"
  | "success"
  | "permission-denied"
  | "no-device"
  | "device-busy"
  | "unsupported"
  | "network-error"
  | "provider-error"
  | "cancelled"
  | "too-short";

interface UsePronunciationEngineOptions {
  expectedText: string;
  language: string;
  cardId?: string;
  listId?: string;
}

export function usePronunciationEngine({ expectedText, language, cardId, listId }: UsePronunciationEngineOptions) {
  const [engineState, setEngineState] = useState<PronunciationEngineState>("idle");
  const [result, setResult] = useState<NormalizedPronunciationResult | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const assess = useCallback(async (recording: AudioRecording) => {
    setEngineState("processing");
    setEngineError(null);
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("AUTH_REQUIRED");
      const form = new FormData();
      form.append("audio", recording.blob, `attempt.${audioExtension(recording.mimeType)}`);
      form.append("mimeType", recording.mimeType);
      form.append("expectedText", expectedText);
      form.append("language", language);
      form.append("mode", "auto");
      form.append("durationMs", String(recording.durationMs));
      if (cardId) form.append("cardId", cardId);
      if (listId) form.append("listId", listId);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assess-pronunciation`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: form,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as (NormalizedPronunciationResult & { error?: string; message?: string }) | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || payload?.error || `HTTP_${response.status}`);
      }
      setResult(payload);
      setEngineState("success");
    } catch (caught) {
      if (controller.signal.aborted) {
        setEngineState("cancelled");
        return;
      }
      const message = caught instanceof Error ? caught.message : "ASSESSMENT_ERROR";
      const isNetwork = caught instanceof TypeError || message.includes("Failed to fetch") || message.includes("Network");
      setEngineState(isNetwork ? "network-error" : "provider-error");
      setEngineError(isNetwork
        ? "Sem conexão com o serviço de pronúncia. Verifique a internet e tente novamente."
        : "O serviço de pronúncia está temporariamente indisponível. Tente novamente sem perder o card.");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [cardId, expectedText, language, listId]);

  const recorder = useAudioRecorder({ onRecorded: assess });
  const state = useMemo<PronunciationEngineState>(() => {
    if (["processing", "success", "network-error", "provider-error"].includes(engineState)) return engineState;
    return recorder.state;
  }, [engineState, recorder.state]);

  const start = useCallback(async () => {
    requestRef.current?.abort();
    setResult(null);
    setEngineError(null);
    setEngineState("idle");
    await recorder.start();
  }, [recorder]);

  const cancel = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    recorder.cancel();
    setEngineState("cancelled");
  }, [recorder]);

  const reset = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    recorder.reset();
    setResult(null);
    setEngineError(null);
    setEngineState("idle");
  }, [recorder]);

  return {
    state,
    result,
    error: engineError || recorder.error,
    isSupported: recorder.isSupported,
    isRecording: recorder.isRecording,
    isProcessing: state === "processing",
    start,
    stop: recorder.stop,
    cancel,
    reset,
  };
}
