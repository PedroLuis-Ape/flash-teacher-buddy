import { useCallback, useEffect, useRef, useState } from "react";
import { pickSupportedAudioMime } from "./audioMime";

export type AudioRecorderState =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "ready"
  | "permission-denied"
  | "no-device"
  | "device-busy"
  | "unsupported"
  | "cancelled"
  | "too-short";

export interface AudioRecording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

interface UseAudioRecorderOptions {
  maxDurationMs?: number;
  minDurationMs?: number;
  onRecorded?: (recording: AudioRecording) => void | Promise<void>;
}

export function useAudioRecorder({
  maxDurationMs = 12_000,
  minDurationMs = 350,
  onRecorded,
}: UseAudioRecorderOptions = {}) {
  const [state, setState] = useState<AudioRecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const mountedRef = useRef(true);

  const release = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch { release(); }
    } else {
      release();
    }
    if (mountedRef.current) setState("cancelled");
  }, [release]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    try { recorder.stop(); } catch { release(); }
  }, [release]);

  const start = useCallback(async () => {
    if (state === "recording" || state === "requesting-permission") return;
    setError(null);
    cancelledRef.current = false;
    chunksRef.current = [];

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("unsupported");
      setError("Este navegador não oferece gravação de áudio compatível.");
      return;
    }

    setState("requesting-permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelledRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const preferredMime = pickSupportedAudioMime();
      const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        if (!mountedRef.current) return;
        setError("Não foi possível gravar o áudio. Tente novamente.");
        setState("idle");
        release();
      };
      recorder.onstop = async () => {
        const durationMs = Date.now() - startedAtRef.current;
        const mimeType = recorder.mimeType || preferredMime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        release();
        if (!mountedRef.current || cancelledRef.current) return;
        if (durationMs < minDurationMs || blob.size < 400) {
          setState("too-short");
          setError("A fala ficou curta demais ou silenciosa. Faça uma nova tentativa.");
          return;
        }
        setState("ready");
        await onRecorded?.({ blob, mimeType, durationMs });
      };

      startedAtRef.current = Date.now();
      recorder.start(250);
      setState("recording");
      timerRef.current = setTimeout(stop, maxDurationMs);
    } catch (caught) {
      release();
      const name = caught instanceof DOMException ? caught.name : "UnknownError";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setState("permission-denied");
        setError("Permissão de microfone negada. Libere o microfone nas configurações do navegador.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setState("no-device");
        setError("Nenhum microfone foi encontrado neste dispositivo.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setState("device-busy");
        setError("O microfone parece estar ocupado por outro aplicativo.");
      } else {
        setState("idle");
        setError("Não foi possível acessar o microfone.");
      }
    }
  }, [maxDurationMs, minDurationMs, onRecorded, release, state, stop]);

  const reset = useCallback(() => {
    cancel();
    cancelledRef.current = false;
    setError(null);
    setState("idle");
  }, [cancel]);

  useEffect(() => () => {
    mountedRef.current = false;
    cancel();
  }, [cancel]);

  return {
    state,
    error,
    isRecording: state === "recording",
    isSupported: typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined",
    start,
    stop,
    cancel,
    reset,
  };
}
