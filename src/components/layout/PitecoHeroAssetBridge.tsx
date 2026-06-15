import { useEffect } from "react";
import pitecoBase64 from "@/assets/piteco-heart-hero.webp.b64?raw";

export function PitecoHeroAssetBridge() {
  useEffect(() => {
    const binary = window.atob(pitecoBase64.trim());
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const objectUrl = URL.createObjectURL(
      new Blob([bytes], { type: "image/webp" }),
    );

    document.documentElement.style.setProperty(
      "--piteco-heart-hero",
      `url("${objectUrl}")`,
    );

    return () => {
      document.documentElement.style.removeProperty("--piteco-heart-hero");
      URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return null;
}
