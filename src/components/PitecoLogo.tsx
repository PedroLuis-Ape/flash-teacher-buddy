import { useState, useEffect } from "react";
import pitecoImage from "@/assets/piteco-logo.png";
import { removeChromaBackground } from "@/lib/chromaKey";

export function PitecoLogo({ className = "h-16 w-16" }: { className?: string }) {
  const [processedImage, setProcessedImage] = useState<string>("");

  useEffect(() => {
    // Remove purple/violet chroma key background
    removeChromaBackground(
      pitecoImage,
      { r: 138, g: 43, b: 226 }, // Purple/violet color
      60
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
