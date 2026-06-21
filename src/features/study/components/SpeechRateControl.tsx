import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Gauge } from "lucide-react";

const SPEECH_RATE_KEY = "speechRate";

export function getSpeechRate(): number {
  if (typeof window === "undefined") return 1;
  return Number(localStorage.getItem(SPEECH_RATE_KEY) || "1");
}

export function SpeechRateControl() {
  const [rate, setRate] = useState(() => getSpeechRate());

  useEffect(() => {
    localStorage.setItem(SPEECH_RATE_KEY, rate.toString());
    window.dispatchEvent(new CustomEvent("speechRateChanged", { detail: rate }));
  }, [rate]);

  const toggleRate = () => {
    window.speechSynthesis?.cancel();
    setRate((current) => current === 1 ? 0.5 : 1);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleRate}
      className="gap-2"
      title={rate === 1
        ? "Velocidade da fala: natural"
        : "Velocidade da fala: palavra por palavra"}
    >
      <Gauge className="h-4 w-4" />
      <span className="text-xs font-medium">{rate === 1 ? "1x" : "0.5x"}</span>
    </Button>
  );
}
