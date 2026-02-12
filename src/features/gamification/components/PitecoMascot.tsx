import { useState, useEffect } from "react";
import pitecoImage from "@/assets/piteco.png";
import { removeChromaBackground } from "@/lib/chromaKey";

export function PitecoMascot() {
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
        console.error("Failed to process mascot image:", err);
        setProcessedImage(pitecoImage); // Fallback to original
      });
  }, []);

  if (!processedImage) return null;

  return (
    <img
      loading="lazy"
      src={processedImage}
      alt=""
      aria-hidden="true"
      className="fixed bottom-0 right-4 h-[35vh] max-h-96 w-auto object-contain drop-shadow-xl pointer-events-none z-10 sm:h-[30vh] md:h-[35vh]"
      style={{
        maxWidth: "min(26vw, 300px)",
      }}
    />
  );
}
