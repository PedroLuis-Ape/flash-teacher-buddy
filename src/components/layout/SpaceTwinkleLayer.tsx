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

type CometLane = {
  top: number;
  delay: number;
  travelX: string;
  travelY: string;
  durationScale: number;
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

const FULL_COMET_LANES: readonly CometLane[] = [
  { top: 3, delay: 0, travelX: "134vw", travelY: "44vh", durationScale: 1 },
  { top: 20, delay: 1_200, travelX: "136vw", travelY: "43vh", durationScale: 1.03 },
  { top: 38, delay: 2_400, travelX: "138vw", travelY: "42vh", durationScale: 1.06 },
  { top: 56, delay: 3_600, travelX: "140vw", travelY: "41vh", durationScale: 1.09 },
];

const BALANCED_COMET_LANES: readonly CometLane[] = [
  { top: 20, delay: 0, travelX: "128vw", travelY: "38vh", durationScale: 1 },
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
  const cometRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [motionTier, setMotionTier] = useState<GalaxyMotionTier>(() => detectGalaxyMotionTier());
  const isGalaxy = palette === "galaxy";
  const motionAllowed = settings.animations && !settings.reduceMotion && motionTier !== "static";
  const starMotionAllowed = motionAllowed && settings.decorativeEffects;
  const armMotionAllowed = starMotionAllowed && motionTier === "full";
  const shootingStarAllowed = motionAllowed && settings.decorativeEffects;
  const visibleStars = STARS.slice(0, getGalaxyStarLimit(motionTier));
  const cometLanes = motionTier === "full" ? FULL_COMET_LANES : BALANCED_COMET_LANES;

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

    const timing = getShootingStarTiming(motionTier);
    const lanes = motionTier === "full" ? FULL_COMET_LANES : BALANCED_COMET_LANES;
    let groupTimer: number | undefined;
    const laneTimers = new Set<number>();
    const activeAnimations = new Set<Animation>();
    let cancelled = false;

    const clearTimers = () => {
      if (groupTimer) window.clearTimeout(groupTimer);
      groupTimer = undefined;
      laneTimers.forEach((timer) => window.clearTimeout(timer));
      laneTimers.clear();
    };

    const cancelAnimations = () => {
      activeAnimations.forEach((animation) => animation.cancel());
      activeAnimations.clear();
    };

    const animateLane = (lane: CometLane, index: number) => {
      if (cancelled || document.hidden) return;
      const comet = cometRefs.current[index];
      if (!comet || typeof comet.animate !== "function") return;

      comet.style.top = `${lane.top}%`;
      comet.style.left = "-16rem";
      const duration = Math.round(timing.duration * lane.durationScale);

      const animation = comet.animate(
        [
          { opacity: 0, transform: "translate3d(0,0,0) rotate(-22deg) scale(.94)" },
          { opacity: .56, offset: .12 },
          { opacity: 1, offset: .34, transform: "translate3d(36vw,11vh,0) rotate(-22deg) scale(1)" },
          { opacity: .82, offset: .72 },
          { opacity: 0, transform: `translate3d(${lane.travelX},${lane.travelY},0) rotate(-22deg) scale(.98)` },
        ],
        { duration, easing: "cubic-bezier(.18,.55,.28,1)" },
      );

      activeAnimations.add(animation);
      animation.finished.catch(() => undefined).finally(() => activeAnimations.delete(animation));
    };

    const runGroup = () => {
      groupTimer = undefined;
      if (cancelled || document.hidden) return;

      lanes.forEach((lane, index) => {
        const timer = window.setTimeout(() => {
          laneTimers.delete(timer);
          animateLane(lane, index);
        }, lane.delay);
        laneTimers.add(timer);
      });

      groupTimer = window.setTimeout(
        runGroup,
        timing.repeatDelayMin + Math.random() * timing.repeatDelayVariation,
      );
    };

    const scheduleFirstGroup = () => {
      if (cancelled || document.hidden) return;
      groupTimer = window.setTimeout(
        runGroup,
        timing.firstDelayMin + Math.random() * timing.firstDelayVariation,
      );
    };

    const handleVisibility = () => {
      if (document.hidden) {
        clearTimers();
        cancelAnimations();
        return;
      }
      scheduleFirstGroup();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    scheduleFirstGroup();

    return () => {
      cancelled = true;
      clearTimers();
      cancelAnimations();
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
          {shootingStarAllowed && cometLanes.map((_, index) => (
            <span
              key={`comet-${motionTier}-${index}`}
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
