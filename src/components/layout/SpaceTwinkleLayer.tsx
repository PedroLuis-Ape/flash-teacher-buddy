import { Fragment, useEffect, useRef } from "react";
import { PitecoHeroAssetBridge } from "@/components/layout/PitecoHeroAssetBridge";
import { usePalette } from "@/hooks/usePalette";
import { usePerformance } from "@/contexts/PerformanceContext";
import "@/styles/space-layouts.css";

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
  { left: "7%", top: "14%", size: 3, duration: 2600, delay: -150, glow: "rgba(255,255,255,.95)" },
  { left: "18%", top: "66%", size: 2, duration: 3400, delay: -800, glow: "rgba(220,190,255,.95)" },
  { left: "38%", top: "81%", size: 2, duration: 2900, delay: -450, glow: "rgba(255,255,255,.95)" },
  { left: "57%", top: "53%", size: 2, duration: 3100, delay: -1050, glow: "rgba(255,255,255,.95)" },
  { left: "75%", top: "27%", size: 2, duration: 2800, delay: -1450, glow: "rgba(255,255,255,.95)" },
  { left: "93%", top: "19%", size: 2, duration: 3200, delay: -1900, glow: "rgba(255,255,255,.95)" },
  { left: "29%", top: "31%", size: 4, duration: 4100, delay: -1250, glow: "rgba(195,225,255,.95)", desktopOnly: true },
  { left: "67%", top: "76%", size: 4, duration: 4400, delay: -200, glow: "rgba(200,225,255,.95)", desktopOnly: true },
  { left: "84%", top: "58%", size: 3, duration: 3500, delay: -650, glow: "rgba(230,190,255,.95)", desktopOnly: true },
];

export function SpaceTwinkleLayer() {
  const { palette } = usePalette();
  const { settings } = usePerformance();
  const shootingStarRef = useRef<HTMLSpanElement>(null);
  const isGalaxy = palette === "galaxy";
  const motionAllowed = settings.animations && !settings.reduceMotion && settings.decorativeEffects;

  useEffect(() => {
    if (!isGalaxy || !motionAllowed) return;
    const star = shootingStarRef.current;
    if (!star || typeof star.animate !== "function") return;

    let timer: number | undefined;
    let cancelled = false;
    const mobile = window.matchMedia("(max-width: 767px), (update: slow)").matches;

    const schedule = (first = false) => {
      if (cancelled) return;
      const min = first ? 9000 : mobile ? 35000 : 24000;
      const variation = first ? 7000 : mobile ? 25000 : 22000;
      timer = window.setTimeout(run, min + Math.random() * variation);
    };

    const run = () => {
      if (cancelled) return;
      if (document.hidden) {
        schedule();
        return;
      }
      const top = 8 + Math.random() * 42;
      star.style.top = `${top}%`;
      star.style.left = "-12rem";
      const animation = star.animate(
        [
          { opacity: 0, transform: "translate3d(0,0,0) rotate(-24deg)" },
          { opacity: 1, offset: 0.12 },
          { opacity: 0.95, offset: 0.72 },
          { opacity: 0, transform: "translate3d(calc(100vw + 22rem),52vh,0) rotate(-24deg)" },
        ],
        { duration: mobile ? 1500 : 1250, easing: "cubic-bezier(.2,.65,.35,1)" },
      );
      animation.finished.catch(() => undefined).finally(() => schedule());
    };

    schedule(true);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [isGalaxy, motionAllowed]);

  return (
    <Fragment>
      <PitecoHeroAssetBridge />
      {isGalaxy && (
        <div aria-hidden="true" className="space-galaxy-effects">
          <span className="space-galaxy-arm" />
          {settings.decorativeEffects && STARS.map((star) => (
            <span
              key={`${star.left}-${star.top}`}
              data-space-twinkle
              className={`space-twinkle-star${star.desktopOnly ? " space-twinkle-star--desktop" : ""}`}
              style={{
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                background: star.glow,
                boxShadow: `0 0 ${star.size * 3}px ${star.size}px ${star.glow}`,
                "--twinkle-duration": `${star.duration}ms`,
                "--twinkle-delay": `${star.delay}ms`,
              } as React.CSSProperties}
            />
          ))}
          {motionAllowed && <span ref={shootingStarRef} className="space-shooting-star" />}
        </div>
      )}
    </Fragment>
  );
}
