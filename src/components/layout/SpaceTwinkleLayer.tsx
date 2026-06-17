import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { PitecoHeroAssetBridge } from "@/components/layout/PitecoHeroAssetBridge";
import { usePalette } from "@/hooks/usePalette";
import { usePerformance } from "@/contexts/PerformanceContext";
import {
  detectGalaxyMotionTier,
  getGalaxyCometPlan,
  getGalaxyStarLimit,
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
  peak: number;
};

const STARS: readonly TwinkleStar[] = [
  { left: "7%", top: "14%", size: 3, duration: 7_200, delay: -1_350, glow: "rgba(255,255,255,.96)", peak: .96 },
  { left: "38%", top: "81%", size: 2, duration: 8_900, delay: -5_200, glow: "rgba(224,196,255,.9)", peak: .86 },
  { left: "75%", top: "27%", size: 2, duration: 6_600, delay: -2_700, glow: "rgba(255,255,255,.92)", peak: .91 },
  { left: "18%", top: "66%", size: 2, duration: 9_700, delay: -7_100, glow: "rgba(255,255,255,.88)", peak: .82 },
  { left: "57%", top: "53%", size: 3, duration: 8_100, delay: -8_900, glow: "rgba(195,225,255,.92)", peak: .9 },
  { left: "90%", top: "58%", size: 2, duration: 6_200, delay: -3_850, glow: "rgba(235,202,255,.9)", peak: .84 },
  { left: "28%", top: "34%", size: 2, duration: 9_300, delay: -6_800, glow: "rgba(205,228,255,.88)", peak: .8 },
  { left: "82%", top: "86%", size: 2, duration: 7_700, delay: -6_450, glow: "rgba(255,255,255,.9)", peak: .87 },
  { left: "48%", top: "18%", size: 2, duration: 8_500, delay: -4_300, glow: "rgba(230,214,255,.9)", peak: .85 },
  { left: "66%", top: "72%", size: 3, duration: 9_900, delay: -4_600, glow: "rgba(205,228,255,.9)", peak: .92 },
];

const FULL_COMET_TOPS = [2, 20, 39, 58] as const;
const FULL_COMET_SCALES = [1, .95, .9, .86] as const;
const FULL_COMET_PEAKS = [.98, .9, .82, .75] as const;
const FULL_COMET_DURATION_OFFSETS = [0, 160, 320, 480] as const;

interface NavigatorWithConnection extends Navigator {
  connection?: EventTarget;
}

function motionClass(tier: GalaxyMotionTier) {
  return `space-galaxy-effects--${tier}`;
}

export function SpaceTwinkleLayer() {
  const { palette } = usePalette();
  const { settings } = usePerformance();
  const cometRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [motionTier, setMotionTier] = useState<GalaxyMotionTier>(() => detectGalaxyMotionTier());
  const cometPlan = useMemo(() => getGalaxyCometPlan(motionTier), [motionTier]);
  const isGalaxy = palette === "galaxy";
  const motionAllowed = settings.animations && !settings.reduceMotion && motionTier !== "static";
  const starMotionAllowed = motionAllowed && settings.decorativeEffects;
  const armMotionAllowed = starMotionAllowed && motionTier === "full";
  const cometMotionAllowed = motionAllowed && settings.decorativeEffects && cometPlan.count > 0;
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
    if (!isGalaxy || !cometMotionAllowed || cometPlan.count === 0) return;

    let groupTimer: number | undefined;
    const launchTimers = new Set<number>();
    const activeAnimations = new Set<Animation>();
    let cancelled = false;

    const clearGroupTimer = () => {
      if (groupTimer !== undefined) window.clearTimeout(groupTimer);
      groupTimer = undefined;
    };

    const clearLaunchTimers = () => {
      launchTimers.forEach((timer) => window.clearTimeout(timer));
      launchTimers.clear();
    };

    const cancelAnimations = () => {
      activeAnimations.forEach((animation) => animation.cancel());
      activeAnimations.clear();
      cometRefs.current.forEach((comet) => {
        if (comet) comet.style.willChange = "auto";
      });
    };

    const animateComet = (index: number, verticalJitter: number) => {
      const comet = cometRefs.current[index];
      if (!comet || typeof comet.animate !== "function" || cancelled || document.hidden) return;

      const isFull = motionTier === "full";
      const top = isFull
        ? FULL_COMET_TOPS[index] + verticalJitter
        : 10 + Math.random() * 34;
      const scale = isFull ? FULL_COMET_SCALES[index] : .9;
      const peak = isFull ? FULL_COMET_PEAKS[index] : .68;
      const duration = cometPlan.duration + (isFull ? FULL_COMET_DURATION_OFFSETS[index] : 0);
      const travelX = isFull ? 132 : 124;
      const travelY = isFull ? 52 : 38;
      const rotation = isFull ? 21 : 19;
      const transformAt = (progress: number) => (
        `translate3d(${travelX * progress}vw,${travelY * progress}vh,0) rotate(${rotation}deg) scale(${scale})`
      );

      comet.style.top = `${top}%`;
      comet.style.left = "-15rem";
      comet.style.willChange = "transform, opacity";

      const animation = comet.animate(
        [
          { opacity: 0, transform: transformAt(0), offset: 0 },
          { opacity: peak * .55, transform: transformAt(.12), offset: .12 },
          { opacity: peak, transform: transformAt(.34), offset: .34 },
          { opacity: peak * .78, transform: transformAt(.7), offset: .7 },
          { opacity: 0, transform: transformAt(1), offset: 1 },
        ],
        { duration, easing: "cubic-bezier(.4,0,.2,1)" },
      );

      activeAnimations.add(animation);
      animation.finished.catch(() => undefined).finally(() => {
        activeAnimations.delete(animation);
        comet.style.willChange = "auto";
      });
    };

    const schedule = (first = false) => {
      if (cancelled || document.hidden) return;
      clearGroupTimer();
      const min = first ? cometPlan.firstDelayMin : cometPlan.repeatDelayMin;
      const variation = first ? cometPlan.firstDelayVariation : cometPlan.repeatDelayVariation;
      groupTimer = window.setTimeout(runGroup, min + Math.random() * variation);
    };

    const runGroup = () => {
      groupTimer = undefined;
      if (cancelled || document.hidden) return;

      const verticalJitter = motionTier === "full" ? -2 + Math.random() * 4 : 0;
      cometPlan.staggerDelays.forEach((delay, index) => {
        const launchTimer = window.setTimeout(() => {
          launchTimers.delete(launchTimer);
          animateComet(index, verticalJitter);
        }, delay);
        launchTimers.add(launchTimer);
      });

      schedule();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        clearGroupTimer();
        clearLaunchTimers();
        cancelAnimations();
        return;
      }
      schedule(true);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    schedule(true);

    return () => {
      cancelled = true;
      clearGroupTimer();
      clearLaunchTimers();
      cancelAnimations();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [cometMotionAllowed, cometPlan, isGalaxy, motionTier]);

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
                boxShadow: motionTier === "static"
                  ? "none"
                  : `0 0 ${star.size * (motionTier === "full" ? 3.4 : 2.4)}px ${star.size * (motionTier === "full" ? .85 : .55)}px ${star.glow}`,
                "--twinkle-duration": `${star.duration}ms`,
                "--twinkle-delay": `${star.delay}ms`,
                "--twinkle-low": Math.max(.16, star.peak - .7),
                "--twinkle-mid": Math.max(.46, star.peak - .34),
                "--twinkle-peak": star.peak,
                "--twinkle-fall": Math.max(.34, star.peak - .48),
              } as React.CSSProperties}
            />
          ))}
          {cometMotionAllowed && Array.from({ length: cometPlan.count }, (_, index) => (
            <span
              key={index}
              ref={(node) => {
                cometRefs.current[index] = node;
              }}
              className={`space-shooting-star space-shooting-star--${index + 1}`}
            />
          ))}
        </div>
      )}
    </Fragment>
  );
}
