import { useEffect, useRef } from "react";
import pitecoBase64 from "@/assets/piteco-heart-hero.webp.b64?raw";

type TwinkleStar = {
  left: string;
  top: string;
  size: number;
  duration: number;
  delay: number;
  glow: string;
  desktopOnly?: boolean;
};

const STARS: readonly TwinkleStar[] = [
  { left: "7%", top: "14%", size: 3, duration: 2400, delay: 150, glow: "rgba(255,255,255,.95)" },
  { left: "18%", top: "66%", size: 2, duration: 3100, delay: 800, glow: "rgba(220,190,255,.95)" },
  { left: "29%", top: "31%", size: 4, duration: 3900, delay: 1250, glow: "rgba(195,225,255,.95)" },
  { left: "38%", top: "81%", size: 2, duration: 2700, delay: 450, glow: "rgba(255,255,255,.95)" },
  { left: "49%", top: "18%", size: 3, duration: 3500, delay: 1700, glow: "rgba(235,200,255,.95)" },
  { left: "57%", top: "53%", size: 2, duration: 2850, delay: 1050, glow: "rgba(255,255,255,.95)" },
  { left: "67%", top: "76%", size: 4, duration: 4200, delay: 200, glow: "rgba(200,225,255,.95)" },
  { left: "75%", top: "27%", size: 2, duration: 2600, delay: 1450, glow: "rgba(255,255,255,.95)" },
  { left: "84%", top: "58%", size: 3, duration: 3300, delay: 650, glow: "rgba(230,190,255,.95)" },
  { left: "93%", top: "19%", size: 2, duration: 3000, delay: 1900, glow: "rgba(255,255,255,.95)" },
  { left: "12%", top: "43%", size: 2, duration: 3650, delay: 1100, glow: "rgba(195,225,255,.95)", desktopOnly: true },
  { left: "33%", top: "59%", size: 3, duration: 2800, delay: 300, glow: "rgba(255,255,255,.95)", desktopOnly: true },
  { left: "62%", top: "37%", size: 2, duration: 4050, delay: 1550, glow: "rgba(225,195,255,.95)", desktopOnly: true },
  { left: "88%", top: "84%", size: 3, duration: 3200, delay: 900, glow: "rgba(200,225,255,.95)", desktopOnly: true },
];

export function SpaceTwinkleLayer() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const binary = window.atob(pitecoBase64.trim());
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const pitecoUrl = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
    document.documentElement.style.setProperty("--piteco-heart-hero", `url("${pitecoUrl}")`);

    const layer = layerRef.current;
    if (!layer) {
      return () => {
        document.documentElement.style.removeProperty("--piteco-heart-hero");
        URL.revokeObjectURL(pitecoUrl);
      };
    }

    const stars = Array.from(layer.querySelectorAll<HTMLElement>("[data-space-twinkle]"));
    const animations = stars.map((star, index) => {
      const config = STARS[index];
      return star.animate(
        [
          { opacity: 0.12, transform: "scale(.62)" },
          { opacity: 0.95, transform: "scale(1.45)", offset: 0.48 },
          { opacity: 0.18, transform: "scale(.75)" },
        ],
        {
          duration: config.duration,
          delay: -config.delay,
          iterations: Infinity,
          easing: "ease-in-out",
        },
      );
    });

    const syncVisibility = () => {
      for (const animation of animations) {
        if (document.hidden) animation.pause();
        else animation.play();
      }
    };

    document.addEventListener("visibilitychange", syncVisibility);
    syncVisibility();

    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      for (const animation of animations) animation.cancel();
      document.documentElement.style.removeProperty("--piteco-heart-hero");
      URL.revokeObjectURL(pitecoUrl);
    };
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 35 }}
    >
      {STARS.map((star) => (
        <span
          key={`${star.left}-${star.top}`}
          data-space-twinkle
          className={star.desktopOnly ? "hidden md:block" : undefined}
          style={{
            position: "absolute",
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            borderRadius: 999,
            background: star.glow,
            boxShadow: `0 0 ${star.size * 3}px ${star.size}px ${star.glow}`,
            opacity: 0.2,
            transformOrigin: "center",
            willChange: "opacity, transform",
          }}
        />
      ))}
    </div>
  );
}
