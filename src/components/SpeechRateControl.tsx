import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Gauge } from "lucide-react";

const SPEECH_RATE_KEY = "speechRate";

/**
 * Get the current speech rate from localStorage
 * Returns 1 (normal) or 0.5 (slow)
 */
export function getSpeechRate(): number {
  if (typeof window === 'undefined') return 1;
  return Number(localStorage.getItem(SPEECH_RATE_KEY) || "1");
}

export function SpeechRateControl() {
  const [rate, setRate] = useState(() => getSpeechRate());

  useEffect(() => {
    localStorage.setItem(SPEECH_RATE_KEY, rate.toString());
    // Dispatch event so other components can react
    window.dispatchEvent(new CustomEvent('speechRateChanged', { detail: rate }));
  }, [rate]);

  const toggleRate = () => {
    setRate(current => current === 1 ? 0.5 : 1);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleRate}
      className="gap-2"
      title={`Velocidade da fala: ${rate === 1 ? "Normal" : "Lenta (0.5x)"}`}
    >
      <Gauge className="h-4 w-4" />
      <span className="text-xs font-medium">{rate === 1 ? "1x" : "0.5x"}</span>
    </Button>
  );
}
