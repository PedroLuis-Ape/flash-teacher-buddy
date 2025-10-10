import { useState, useEffect } from "react";
import pitecoImage from "@/assets/piteco-logo.png";
import { removeChromaBackground } from "@/lib/chromaKey";

export function PitecoLogo({ className = "h-16 w-16" }: { className?: string }) {
  const [processedImage, setProcessedImage] = useState<string>("");

  useEffect(() => {
    // Remove purple chroma key background carefully to preserve character colors
    removeChromaBackground(
      pitecoImage,
      { r: 165, g: 100, b: 230 }, // Target the specific purple background
      30 // Low tolerance to avoid affecting the character
    )
      .then(setProcessedImage)
      .catch((err) => {
        console.error("Failed to process logo image:", err);
        setProcessedImage(pitecoImage); // Fallback to original
      });
  }, []);

  if (!processedImage) return <div className={className} />;

  return (
    <img
      src={processedImage}
      alt="Piteco - Mascote APE"
      className={`${className} object-contain drop-shadow-lg`}
    />
  );
}
