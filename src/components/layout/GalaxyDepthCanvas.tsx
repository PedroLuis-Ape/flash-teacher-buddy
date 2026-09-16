import { useEffect, useRef } from "react";
import type { GalaxyMotionTier } from "@/lib/galaxyPerformance";
import type { GalaxyVisualQuality } from "@/lib/performanceSettings";

type StarDepth = 0 | 1 | 2;

type DepthStar = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  phase: number;
  twinkle: number;
  depth: StarDepth;
  color: string;
};

interface GalaxyDepthCanvasProps {
  tier: GalaxyMotionTier;
  quality: GalaxyVisualQuality;
  animated: boolean;
  visible: boolean;
  landing: boolean;
}

const STAR_COLORS = [
  "255,255,255",
  "218,232,255",
  "205,217,255",
  "232,213,255",
] as const;

const DEPTH_PARALLAX = [2.2, 5.4, 9.5] as const;
const DEPTH_SCROLL = [0.0025, 0.0055, 0.009] as const;
const DEPTH_DRIFT = [0.45, 0.9, 1.45] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrap(value: number, size: number) {
  if (size <= 0) return value;
  const wrapped = value % size;
  return wrapped < 0 ? wrapped + size : wrapped;
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function getPixelRatio(tier: GalaxyMotionTier, quality: GalaxyVisualQuality) {
  const device = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  if (tier === "static") return Math.min(device, 1.15);
  if (tier === "balanced") return Math.min(device, quality === "high" ? 1.55 : 1.4);
  return Math.min(device, quality === "high" ? 2 : 1.75);
}

function getStarCount(
  width: number,
  height: number,
  tier: GalaxyMotionTier,
  quality: GalaxyVisualQuality,
  landing: boolean,
) {
  const areaCount = Math.round((width * height) / 12_500);
  const tierCap = tier === "full" ? (quality === "high" ? 210 : 168) : tier === "balanced" ? 112 : 54;
  const floor = tier === "full" ? 96 : tier === "balanced" ? 62 : 34;
  const landingBoost = landing && tier === "full" ? 14 : 0;
  return clamp(areaCount + landingBoost, floor, tierCap);
}

function buildStars(
  width: number,
  height: number,
  tier: GalaxyMotionTier,
  quality: GalaxyVisualQuality,
  landing: boolean,
): DepthStar[] {
  const count = getStarCount(width, height, tier, quality, landing);
  const random = seededRandom(0xa9e2026 ^ Math.round(width) ^ (Math.round(height) << 8));

  return Array.from({ length: count }, (_, index) => {
    const roll = random();
    const depth: StarDepth = roll < 0.61 ? 0 : roll < 0.9 ? 1 : 2;
    const depthScale = depth === 0 ? 0.55 : depth === 1 ? 0.92 : 1.35;
    const radius = (0.55 + random() * 0.82) * depthScale;
    const alpha = depth === 0 ? 0.28 + random() * 0.34 : depth === 1 ? 0.38 + random() * 0.42 : 0.5 + random() * 0.42;

    return {
      x: random(),
      y: random(),
      radius,
      alpha,
      phase: random() * Math.PI * 2 + index * 0.017,
      twinkle: depth === 0 ? 0.08 : depth === 1 ? 0.13 : 0.17,
      depth,
      color: STAR_COLORS[Math.floor(random() * STAR_COLORS.length)],
    };
  });
}

export function GalaxyDepthCanvas({ tier, quality, animated, visible, landing }: GalaxyDepthCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let stars: DepthStar[] = [];
    let frame = 0;
    let lastPaint = 0;
    let pointerX = 0;
    let pointerY = 0;
    let targetPointerX = 0;
    let targetPointerY = 0;

    const finePointer = window.matchMedia("(pointer: fine)");
    const pointerEnabled = animated && tier === "full" && finePointer.matches;
    const frameInterval = tier === "full"
      ? quality === "high" ? 1000 / 40 : 1000 / 32
      : 1000 / 24;

    const paint = (now: number) => {
      pointerX += (targetPointerX - pointerX) * 0.045;
      pointerY += (targetPointerY - pointerY) * 0.045;

      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "screen";

      const scroll = Math.min(window.scrollY || 0, 2600);
      const time = now * 0.001;

      for (const star of stars) {
        const depth = star.depth;
        const parallax = DEPTH_PARALLAX[depth];
        const drift = animated ? Math.sin(time * (0.018 + depth * 0.008) + star.phase) * DEPTH_DRIFT[depth] : 0;
        const x = wrap(star.x * width + pointerX * parallax + drift, width);
        const y = wrap(star.y * height + pointerY * parallax * 0.7 - scroll * DEPTH_SCROLL[depth] + drift * 0.58, height);
        const twinkle = animated ? 1 + Math.sin(time * (0.42 + depth * 0.09) + star.phase) * star.twinkle : 1;
        let alpha = clamp(star.alpha * twinkle, 0.08, 0.98);

        // Keep the left side of the landing hero calm enough for the headline and CTAs.
        if (landing && x < width * 0.54 && y < height * 0.72) alpha *= 0.68;

        if (depth === 2) {
          context.beginPath();
          context.fillStyle = `rgba(${star.color},${(alpha * 0.12).toFixed(3)})`;
          context.arc(x, y, star.radius * 3.35, 0, Math.PI * 2);
          context.fill();
        }

        context.beginPath();
        context.fillStyle = `rgba(${star.color},${alpha.toFixed(3)})`;
        context.arc(x, y, star.radius, 0, Math.PI * 2);
        context.fill();

        if (depth === 2 && quality === "high") {
          context.beginPath();
          context.fillStyle = `rgba(255,255,255,${Math.min(1, alpha + 0.08).toFixed(3)})`;
          context.arc(x, y, Math.max(0.42, star.radius * 0.34), 0, Math.PI * 2);
          context.fill();
        }
      }

      context.globalCompositeOperation = "source-over";
    };

    const resize = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      pixelRatio = getPixelRatio(tier, quality);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      stars = buildStars(width, height, tier, quality, landing);
      paint(performance.now());
    };

    const loop = (now: number) => {
      if (!visible || !animated) return;
      if (now - lastPaint >= frameInterval) {
        paint(now);
        lastPaint = now;
      }
      frame = window.requestAnimationFrame(loop);
    };

    const onPointerMove = (event: PointerEvent) => {
      targetPointerX = clamp((event.clientX / Math.max(width, 1) - 0.5) * 2, -1, 1);
      targetPointerY = clamp((event.clientY / Math.max(height, 1) - 0.5) * 2, -1, 1);
    };

    const onPointerLeave = () => {
      targetPointerX = 0;
      targetPointerY = 0;
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    if (pointerEnabled) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    }

    if (visible && animated) frame = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      if (pointerEnabled) {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerleave", onPointerLeave);
      }
    };
  }, [animated, landing, quality, tier, visible]);

  return (
    <canvas
      ref={canvasRef}
      className="space-galaxy-depth-canvas"
      data-galaxy-depth-tier={tier}
      data-galaxy-depth-quality={quality}
      aria-hidden="true"
    />
  );
}
