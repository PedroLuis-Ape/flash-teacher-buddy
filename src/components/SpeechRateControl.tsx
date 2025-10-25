import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Gauge } from "lucide-react";

export function SpeechRateControl() {
  const [rate, setRate] = useState(() => {
    return Number(localStorage.getItem("speechRate") || "1");
  });

  useEffect(() => {
    localStorage.setItem("speechRate", rate.toString());
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
