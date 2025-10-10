import { useState, useEffect } from "react";
import pitecoImage from "@/assets/piteco-logo.png";
import { removeChromaBackground } from "@/lib/chromaKey";

export function PitecoLogo({ className = "h-16 w-16" }: { className?: string }) {
  const [processedImage, setProcessedImage] = useState<string>("");

  useEffect(() => {
    // Remove purple chroma key background with 20% tolerance
    removeChromaBackground(
      pitecoImage,
      { r: 165, g: 100, b: 230 }, // Lilac/purple background color
      20 // 20% tolerance
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
