import { useCallback, useEffect, useRef, useState } from "react";
import { SpeechOutputService } from "./SpeechOutputService";
import type { SpeechMode, SpeechOutputOptions, SpeechPlaybackResult } from "./types";

export function useSpeechOutput() {
  const serviceRef = useRef<SpeechOutputService | null>(null);
  if (!serviceRef.current) serviceRef.current = new SpeechOutputService();

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeMode, setActiveMode] = useState<SpeechMode | null>(null);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [lastResult, setLastResult] = useState<SpeechPlaybackResult | null>(null);
  const requestRef = useRef(0);

  const stop = useCallback(() => {
    requestRef.current += 1;
    serviceRef.current?.stop();
    setIsSpeaking(false);
    setActiveMode(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const loadVoices = () => setVoicesLoaded(window.speechSynthesis.getVoices().length > 0);
    loadVoices();
    const retries = [100, 500, 1200].map((delay) => window.setTimeout(loadVoices, delay));
    window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
    return () => {
      retries.forEach((timer) => window.clearTimeout(timer));
      window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
    };
  }, []);

  useEffect(() => {
    const handlePageHide = () => stop();
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") stop();
    };
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
      stop();
    };
  }, [stop]);

  const speak = useCallback(async (text: string, options: SpeechOutputOptions = {}) => {
    const request = ++requestRef.current;
    serviceRef.current?.stop();
    setIsSpeaking(true);
    setActiveMode(options.mode ?? "natural");
    const result = await serviceRef.current!.speak(text, options);
    if (request === requestRef.current) {
      setLastResult(result);
      setIsSpeaking(false);
      setActiveMode(null);
    }
    return result;
  }, []);

  return {
    speak,
    stop,
    voicesLoaded,
    isSpeaking,
    activeMode,
    lastResult,
    isSupported: serviceRef.current.isSupported(),
  };
}
