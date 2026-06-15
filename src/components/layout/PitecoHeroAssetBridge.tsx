import { useEffect } from "react";
import pitecoBase64 from "@/assets/piteco-heart-hero.webp.b64?raw";

export function PitecoHeroAssetBridge() {
  useEffect(() => {
    let objectUrl: string | null = null;

    try {
      const encodedImage = pitecoBase64.replace(/\s+/g, "");
      if (!encodedImage) return;

      const binary = window.atob(encodedImage);
      const bytes = new Uint8Array(binary.length);

      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      objectUrl = URL.createObjectURL(
        new Blob([bytes], { type: "image/webp" }),
      );

      document.documentElement.style.setProperty(
        "--piteco-heart-hero",
        `url("${objectUrl}")`,
      );
    } catch (error) {
      console.error("[PitecoHeroAssetBridge] Failed to load hero asset", error);
      document.documentElement.style.removeProperty("--piteco-heart-hero");
    }

    return () => {
      document.documentElement.style.removeProperty("--piteco-heart-hero");
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return null;
}
