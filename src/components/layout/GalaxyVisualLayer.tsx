import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PitecoHeroAssetBridge } from "@/components/layout/PitecoHeroAssetBridge";
import { usePalette } from "@/hooks/usePalette";
import { usePerformance } from "@/contexts/PerformanceContext";
import {
  detectGalaxyMotionTier,
  getGalaxyCometPlan,
  getGalaxyScenePlan,
  getGalaxyStarLimit,
  type GalaxyMotionTier,
} from "@/lib/galaxyPerformance";
import "@/styles/space-layouts.css";
import "@/styles/space-galaxy-mobile-guard.css";
import "@/styles/space-galaxy-scene.css";
import "@/styles/space-galaxy-motion.css";
import "@/styles/space-galaxy-quality.css";
import "@/styles/space-drawer-layout.css";
import "@/styles/space-ui-stars.css";
import "@/styles/space-ui-glitter.css";
import "@/styles/space-ui-live-stars.css";
import "@/styles/space-galaxy-home-mobile-hotfix.css";
import "@/styles/space-galaxy-navigation-performance.css";

type Star = {
  left: string;
  top: string;
  size: number;
  duration: number;
  delay: number;
  glow: string;
  peak: number;
};

const STARS: readonly Star[] = [
  { left: "7%", top: "14%", size: 3, duration: 7200, delay: -1350, glow: "rgba(255,255,255,.96)", peak: .96 },
  { left: "38%", top: "81%", size: 2, duration: 8900, delay: -5200, glow: "rgba(224,196,255,.9)", peak: .86 },
  { left: "75%", top: "27%", size: 2, duration: 6600, delay: -2700, glow: "rgba(255,255,255,.92)", peak: .91 },
  { left: "18%", top: "66%", size: 2, duration: 9700, delay: -7100, glow: "rgba(255,255,255,.88)", peak: .82 },
  { left: "57%", top: "53%", size: 3, duration: 8100, delay: -8900, glow: "rgba(195,225,255,.92)", peak: .9 },
  { left: "90%", top: "58%", size: 2, duration: 6200, delay: -3850, glow: "rgba(235,202,255,.9)", peak: .84 },
  { left: "28%", top: "34%", size: 2, duration: 9300, delay: -6800, glow: "rgba(205,228,255,.88)", peak: .8 },
  { left: "82%", top: "86%", size: 2, duration: 7700, delay: -6450, glow: "rgba(255,255,255,.9)", peak: .87 },
  { left: "48%", top: "18%", size: 2, duration: 8500, delay: -4300, glow: "rgba(230,214,255,.9)", peak: .85 },
  { left: "66%", top: "72%", size: 3, duration: 9900, delay: -4600, glow: "rgba(205,228,255,.9)", peak: .92 },
  { left: "12%", top: "43%", size: 2, duration: 7100, delay: -5550, glow: "rgba(255,245,255,.94)", peak: .9 },
  { left: "33%", top: "11%", size: 3, duration: 8300, delay: -2150, glow: "rgba(214,231,255,.94)", peak: .93 },
  { left: "44%", top: "62%", size: 2, duration: 6900, delay: -4950, glow: "rgba(242,218,255,.92)", peak: .89 },
  { left: "70%", top: "12%", size: 2, duration: 7600, delay: -6250, glow: "rgba(255,255,255,.96)", peak: .94 },
  { left: "86%", top: "40%", size: 3, duration: 8700, delay: -3200, glow: "rgba(204,229,255,.95)", peak: .95 },
  { left: "95%", top: "79%", size: 2, duration: 7400, delay: -5900, glow: "rgba(239,216,255,.93)", peak: .91 },
];

const COMET_TOPS = [3, 18, 34, 51] as const;
const COMET_SCALES = [1, .95, .9, .86] as const;
const COMET_PEAKS = [.98, .9, .82, .75] as const;
const COMET_OFFSETS = [0, 160, 320, 480] as const;

interface NavigatorWithConnection extends Navigator {
  connection?: EventTarget;
}

function GalaxyAsset({ className, src }: { className: string; src: string }) {
  return <img className={`space-galaxy-object ${className}`} src={src} alt="" decoding="async" draggable={false} />;
}

function isRouteTransitioning(): boolean {
  return document.documentElement.hasAttribute("data-route-transitioning");
}

export function GalaxyVisualLayer() {
  const { palette } = usePalette();
  const { settings } = usePerformance();
  const [tier, setTier] = useState<GalaxyMotionTier>(() => detectGalaxyMotionTier());
  const [visible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const cometRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const quality = settings.galaxyQuality;
  const high = quality === "high";
  const isGalaxy = palette === "galaxy";
  const cometPlan = useMemo(() => getGalaxyCometPlan(tier, quality), [quality, tier]);
  const scenePlan = useMemo(() => getGalaxyScenePlan(tier), [tier]);
  const motionAllowed = settings.animations && !settings.reduceMotion && tier !== "static";
  const decorAllowed = motionAllowed && settings.decorativeEffects;
  const stars = STARS.slice(0, getGalaxyStarLimit(tier, quality));

  useEffect(() => {
    const media = [
      window.matchMedia("(prefers-reduced-motion: reduce)"),
      window.matchMedia("(update: slow)"),
      window.matchMedia("(pointer: coarse)"),
      window.matchMedia("(max-width: 1199px)"),
    ];
    const connection = (navigator as NavigatorWithConnection).connection;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTier(detectGalaxyMotionTier()));
    };
    media.forEach((item) => item.addEventListener?.("change", sync));
    connection?.addEventListener?.("change", sync);
    window.addEventListener("resize", sync, { passive: true });
    sync();
    return () => {
      cancelAnimationFrame(frame);
      media.forEach((item) => item.removeEventListener?.("change", sync));
      connection?.removeEventListener?.("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isGalaxy) root.dataset.galaxyMotion = tier;
    return () => {
      if (root.dataset.galaxyMotion === tier) delete root.dataset.galaxyMotion;
    };
  }, [isGalaxy, tier]);

  useEffect(() => {
    const sync = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    if (!isGalaxy || !decorAllowed || cometPlan.count === 0) return;
    let groupTimer: number | undefined;
    const launchTimers = new Set<number>();
    const active = new Set<Animation>();
    let cancelled = false;

    const stop = () => {
      if (groupTimer !== undefined) clearTimeout(groupTimer);
      launchTimers.forEach(clearTimeout);
      launchTimers.clear();
      active.forEach((animation) => animation.cancel());
      active.clear();
    };

    const animate = (index: number, jitter: number) => {
      const comet = cometRefs.current[index];
      if (!comet || cancelled || document.hidden || isRouteTransitioning() || typeof comet.animate !== "function") return;
      const grouped = cometPlan.count === 4;
      const top = grouped ? COMET_TOPS[index] + jitter : 10 + Math.random() * 34;
      const scale = (grouped ? COMET_SCALES[index] : .9) + (high ? .08 : 0);
      const peak = Math.min(1, (grouped ? COMET_PEAKS[index] : .68) + (high ? .1 : 0));
      const duration = cometPlan.duration + (grouped ? COMET_OFFSETS[index] : 0);
      const width = Math.max(window.innerWidth, 320);
      const height = Math.max(window.innerHeight, 480);
      const travelX = width + 520;
      const travelY = Math.min(height * .56, width * .34);
      const rotation = Math.atan2(travelY, travelX) * 180 / Math.PI;
      const at = (progress: number) => `translate3d(${travelX * progress}px,${travelY * progress}px,0) rotate(${rotation}deg) scale(${scale})`;
      comet.style.top = `${top}%`;
      comet.style.left = "-15rem";
      comet.style.willChange = "transform, opacity";
      const animation = comet.animate([
        { opacity: 0, transform: at(0), offset: 0 },
        { opacity: peak * .55, transform: at(.12), offset: .12 },
        { opacity: peak, transform: at(.34), offset: .34 },
        { opacity: peak * .78, transform: at(.7), offset: .7 },
        { opacity: 0, transform: at(1), offset: 1 },
      ], { duration, easing: "cubic-bezier(.4,0,.2,1)" });
      active.add(animation);
      animation.finished.catch(() => undefined).finally(() => {
        active.delete(animation);
        comet.style.willChange = "auto";
      });
    };

    const run = () => {
      if (cancelled || document.hidden) return;
      if (isRouteTransitioning()) {
        groupTimer = window.setTimeout(run, 180);
        return;
      }
      const jitter = cometPlan.count === 4 ? -2 + Math.random() * 4 : 0;
      cometPlan.staggerDelays.forEach((delay, index) => {
        const timer = window.setTimeout(() => {
          launchTimers.delete(timer);
          animate(index, jitter);
        }, delay);
        launchTimers.add(timer);
      });
      schedule(false);
    };

    const schedule = (first: boolean) => {
      if (cancelled || document.hidden) return;
      if (groupTimer !== undefined) clearTimeout(groupTimer);
      const min = first ? cometPlan.firstDelayMin : cometPlan.repeatDelayMin;
      const variation = first ? cometPlan.firstDelayVariation : cometPlan.repeatDelayVariation;
      groupTimer = window.setTimeout(run, min + Math.random() * variation);
    };

    const onVisibility = () => {
      stop();
      if (!document.hidden) schedule(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    schedule(true);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [cometPlan, decorAllowed, high, isGalaxy]);

  const classes = [
    "space-galaxy-effects",
    `space-galaxy-effects--${tier}`,
    `space-galaxy-effects--quality-${quality}`,
    decorAllowed ? "space-galaxy-effects--stars-motion" : "",
    decorAllowed && (tier === "full" || high) ? "space-galaxy-effects--arm-motion" : "",
    decorAllowed && scenePlan.animated ? "space-galaxy-effects--scene-motion" : "",
    visible ? "" : "space-galaxy-effects--paused",
  ].filter(Boolean).join(" ");

  return <>
    <PitecoHeroAssetBridge />
    {isGalaxy && <div aria-hidden="true" className={classes}>
      <span className="space-galaxy-arm" />
      {scenePlan.spiralMain && <GalaxyAsset className="space-galaxy-spiral-main" src="/assets/galaxy/galaxy-spiral-main.svg" />}
      {scenePlan.spiralDistant && <GalaxyAsset className="space-galaxy-spiral-distant" src="/assets/galaxy/galaxy-spiral-distant.svg" />}
      {scenePlan.planet && <GalaxyAsset className="space-galaxy-planet-main" src="/assets/galaxy/galaxy-planet-main.svg" />}
      {scenePlan.moon && <span className="space-galaxy-moon-orbit"><GalaxyAsset className="space-galaxy-moon-small" src="/assets/galaxy/galaxy-moon-small.svg" /></span>}
      {scenePlan.dust && <GalaxyAsset className="space-galaxy-nebula-dust" src="/assets/galaxy/galaxy-nebula-dust.svg" />}
      {scenePlan.nebula && <GalaxyAsset className="space-galaxy-nebula" src="/assets/galaxy/galaxy-nebula-arm.svg" />}
      {stars.map((star) => {
        const peak = Math.min(1, star.peak + (high ? .06 : 0));
        const glow = high ? 1.35 : 1;
        const style = {
          left: star.left,
          top: star.top,
          width: star.size,
          height: star.size,
          background: star.glow,
          boxShadow: tier === "static" ? "none" : `0 0 ${star.size * (tier === "full" ? 3.4 : 2.4) * glow}px ${star.size * (tier === "full" ? .85 : .55) * glow}px ${star.glow}`,
          "--twinkle-duration": `${Math.round(star.duration * (high ? .68 : 1))}ms`,
          "--twinkle-delay": `${star.delay}ms`,
          "--twinkle-low": Math.max(.2, peak - .68),
          "--twinkle-mid": Math.max(.5, peak - .3),
          "--twinkle-peak": peak,
          "--twinkle-fall": Math.max(.38, peak - .44),
        } as CSSProperties;
        return <span key={`${star.left}-${star.top}`} className={`space-twinkle-star${decorAllowed ? "" : " space-twinkle-star--static"}`} style={style} />;
      })}
      {decorAllowed && Array.from({ length: cometPlan.count }, (_, index) => <span key={index} ref={(node) => { cometRefs.current[index] = node; }} className={`space-shooting-star space-shooting-star--${index + 1}`} />)}
    </div>}
  </>;
}
