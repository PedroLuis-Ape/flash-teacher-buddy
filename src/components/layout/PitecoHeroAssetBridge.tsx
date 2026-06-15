import { useEffect } from "react";
import pitecoBase64 from "@/assets/piteco-heart-hero.webp.b64?raw";

export function PitecoHeroAssetBridge() {
  useEffect(() => {
    try {
      const encodedImage = pitecoBase64.replace(/\s+/g, "");
      if (!encodedImage) return;

      const mediaType = ["image", "webp"].join("/");
      const source = `data:${mediaType};base64,${encodedImage}`;

      document.documentElement.style.setProperty(
        "--piteco-heart-hero",
        `url("${source}")`,
      );
    } catch (error) {
      console.error("[PitecoHeroAssetBridge] Failed to register hero asset", error);
      document.documentElement.style.removeProperty("--piteco-heart-hero");
    }

    return () => {
      document.documentElement.style.removeProperty("--piteco-heart-hero");
    };
  }, []);

  return null;
}
