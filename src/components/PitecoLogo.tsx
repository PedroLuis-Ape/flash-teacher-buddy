import { useState, useEffect } from "react";
import pitecoImage from "@/assets/piteco-logo.png";
import { removeChromaBackground } from "@/lib/chromaKey";

export function PitecoLogo({ className = "h-16 w-16" }: { className?: string }) {
  const [processedImage, setProcessedImage] = useState<string>("");

  useEffect(() => {
    // Remove green chroma key background with stronger settings
    removeChromaBackground(
      pitecoImage,
      { r: 50, g: 200, b: 50 }, // Adjusted to match the actual green in the image
      80 // Higher threshold for better green removal
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
