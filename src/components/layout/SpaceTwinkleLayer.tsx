import { Fragment, useEffect, useRef, useState } from "react";
import { PitecoHeroAssetBridge } from "@/components/layout/PitecoHeroAssetBridge";
import { usePalette } from "@/hooks/usePalette";
import { usePerformance } from "@/contexts/PerformanceContext";
import {
  detectGalaxyMotionTier,
  getGalaxyStarLimit,
  getShootingStarTiming,
  type GalaxyMotionTier,
} from "@/lib/galaxyPerformance";
import "@/styles/space-layouts.css";
import "@/styles/space-galaxy-mobile-guard.css";
import "@/styles/space-galaxy-motion.css";

const DRAWER_LAYOUT_CSS = `
[role="dialog"][class~="left-0"][class~="inset-y-0"]{width:min(88vw,360px)!important;max-width:360px!important;height:100dvh!important;overflow:hidden!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:hsl(var(--background))!important}
[role="dialog"][class~="left-0"][class~="inset-y-0"]>[class~="flex-1"][class~="overflow-y-auto"]{min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
[role="dialog"][class~="left-0"][class~="inset-y-0"] [class~="space-y-1"]{display:flex!important;flex-direction:column!important;gap:.35rem!important}
[role="dialog"][class~="left-0"][class~="inset-y-0"] [class~="space-y-1"]>button{width:100%!important;min-height:44px!important;justify-content:flex-start!important}
[role="dialog"][class~="left-0"][class~="inset-y-0"] [data-radix-scroll-area-viewport]{max-height:220px;overscroll-behavior:contain}
[role="dialog"][class~="left-0"][class~="inset-y-0"]>[class~="mt-auto"]{flex:0 0 auto;padding-bottom:max(1rem,env(safe-area-inset-bottom))}
@media(max-width:359px){[role="dialog"][class~="left-0"][class~="inset-y-0"]{width:94vw!important}}
`;

type TwinkleStar = {
  left: string;
  top: string;
  size: number;
  duration: number;
  delay: number;
  glow: string;
};

const STARS: readonly TwinkleStar[] = [
  { left: "7%", top: "14%", size: 3, duration: 11_400, delay: -1_350, glow: "rgba(255,255,255,.9)" },
  { left: "38%", top: "81%", size: 2, duration: 8_900, delay: -5_200, glow: "rgba(224,196,255,.86)" },
  { left: "75%", top: "27%", size: 2, duration: 13_200, delay: -2_700, glow: "rgba(255,255,255,.86)" },
  { left: "18%", top: "66%", size: 2, duration: 10_300, delay: -7_100, glow: "rgba(255,255,255,.82)" },
  { left: "57%", top: "53%", size: 3, duration: 14_600, delay: -8_900, glow: "rgba(195,225,255,.86)" },
  { left: "90%", top: "58%", size: 2, duration: 9_700, delay: -3_850, glow: "rgba(235,202,255,.84)" },
  { left: "28%", top: "34%", size: 2, duration: 12_100, delay: -10_200, glow: "rgba(205,228,255,.8)" },
  { left: "82%", top: "86%", size: 2, duration: 15_400, delay: -6_450, glow: "rgba(255,255,255,.8)" },
  { left: "48%", top: "18%", size: 2, duration: 10_900, delay: -9_300, glow: "rgba(230,214,255,.82)" },
  { left: "66%", top: "72%", size: 3, duration: 13_800, delay: -4_600, glow: "rgba(205,228,255,.82)" },
];

interface NavigatorWithConnection extends Navigator {
  connection?: EventTarget;
}

function motionClass(tier: GalaxyMotionTier) {
  return `space-galaxy-effects--${tier}`;
}

export function SpaceTwinkleLayer() {
  const { palette } = usePalette();
  const { settings } = usePerformance();
  const shootingStarRef = useRef<HTMLSpanElement>(null);
  const [motionTier, setMotionTier] = useState<GalaxyMotionTier>(() => detectGalaxyMotionTier());
  const isGalaxy = palette === "galaxy";
  const motionAllowed = settings.animations && !settings.reduceMotion && motionTier !== "static";
  const starMotionAllowed = motionAllowed && settings.decorativeEffects;
  const armMotionAllowed = starMotionAllowed && motionTier === "full";
  const shootingStarAllowed = motionAllowed && settings.decorativeEffects;
  const visibleStars = STARS.slice(0, getGalaxyStarLimit(motionTier));

  useEffect(() => {
    const mediaQueries = [
      window.matchMedia("(prefers-reduced-motion: reduce)"),
      window.matchMedia("(update: slow)"),
      window.matchMedia("(pointer: coarse)"),
      window.matchMedia("(max-width: 1199px)"),
    ];
    const connection = (navigator as NavigatorWithConnection).connection;
    let frame: number | undefined;

    const sync = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setMotionTier(detectGalaxyMotionTier()));
    };

    mediaQueries.forEach((media) => media.addEventListener?.("change", sync));
    connection?.addEventListener?.("change", sync);
    window.addEventListener("resize", sync, { passive: true });
    sync();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mediaQueries.forEach((media) => media.removeEventListener?.("change", sync));
      connection?.removeEventListener?.("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!isGalaxy) {
      if (root.dataset.galaxyMotion === motionTier) delete root.dataset.galaxyMotion;
      return;
    }

    root.dataset.galaxyMotion = motionTier;
    return () => {
      if (root.dataset.galaxyMotion === motionTier) delete root.dataset.galaxyMotion;
    };
  }, [isGalaxy, motionTier]);

  useEffect(() => {
    if (!isGalaxy || !shootingStarAllowed || motionTier === "static") return;
    const star = shootingStarRef.current;
    if (!star || typeof star.animate !== "function") return;

    const timing = getShootingStarTiming(motionTier);
    let timer: number | undefined;
    let activeAnimation: Animation | null = null;
    let cancelled = false;

    const clearTimer = () => {
      if (timer) window.clearTimeout(timer);
      timer = undefined;
    };

    const schedule = (first = false) => {
      if (cancelled || document.hidden) return;
      clearTimer();
      const min = first ? timing.firstDelayMin : timing.repeatDelayMin;
      const variation = first ? timing.firstDelayVariation : timing.repeatDelayVariation;
      timer = window.setTimeout(run, min + Math.random() * variation);
    };

    const run = () => {
      timer = undefined;
      if (cancelled || document.hidden) return;

      star.style.top = `${10 + Math.random() * 36}%`;
      star.style.left = "-14rem";
      const travelX = motionTier === "balanced" ? "122vw" : "130vw";
      const travelY = motionTier === "balanced" ? "34vh" : "40vh";

      activeAnimation = star.animate(
        [
          { opacity: 0, transform: "translate3d(0,0,0) rotate(-22deg)" },
          { opacity: .48, offset: .16 },
          { opacity: .88, offset: .42 },
          { opacity: .58, offset: .72 },
          { opacity: 0, transform: `translate3d(${travelX},${travelY},0) rotate(-22deg)` },
        ],
        { duration: timing.duration, easing: "cubic-bezier(.22,.58,.34,1)" },
      );

      activeAnimation.finished.catch(() => undefined).finally(() => {
        activeAnimation = null;
        schedule();
      });
    };

    const handleVisibility = () => {
      if (document.hidden) {
        clearTimer();
        activeAnimation?.cancel();
        activeAnimation = null;
        return;
      }
      schedule(true);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    schedule(true);

    return () => {
      cancelled = true;
      clearTimer();
      activeAnimation?.cancel();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isGalaxy, motionTier, shootingStarAllowed]);

  const effectClasses = [
    "space-galaxy-effects",
    motionClass(motionTier),
    starMotionAllowed ? "space-galaxy-effects--stars-motion" : "",
    armMotionAllowed ? "space-galaxy-effects--arm-motion" : "",
  ].filter(Boolean).join(" ");

  return (
    <Fragment>
      <style>{DRAWER_LAYOUT_CSS}</style>
      <PitecoHeroAssetBridge />
      {isGalaxy && (
        <div aria-hidden="true" className={effectClasses}>
          <span className="space-galaxy-arm" />
          {visibleStars.map((star) => (
            <span
              key={`${star.left}-${star.top}`}
              className={`space-twinkle-star${starMotionAllowed ? "" : " space-twinkle-star--static"}`}
              style={{
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                background: star.glow,
                boxShadow: motionTier === "static" ? "none" : `0 0 ${star.size * 2.5}px ${star.size * .7}px ${star.glow}`,
                "--twinkle-duration": `${star.duration}ms`,
                "--twinkle-delay": `${star.delay}ms`,
              } as React.CSSProperties}
            />
          ))}
          {shootingStarAllowed && <span ref={shootingStarRef} className="space-shooting-star" />}
        </div>
      )}
    </Fragment>
  );
}
