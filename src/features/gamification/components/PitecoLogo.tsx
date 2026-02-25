import { useState } from "react";
import pitecoImage from "@/assets/piteco-logo.png";

export function PitecoLogo({ className = "h-16 w-16" }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`${className} flex items-center justify-center rounded-full bg-muted text-lg font-bold`}>
        🐾
      </div>
    );
  }

  return (
    <img
      loading="lazy"
      src={pitecoImage}
      alt="Piteco - Mascote APE"
      className={`${className} object-contain drop-shadow-lg`}
      onError={() => setFailed(true)}
    />
  );
}
