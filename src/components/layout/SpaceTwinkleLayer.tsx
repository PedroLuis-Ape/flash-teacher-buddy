import { Fragment, useEffect, useRef, useState } from "react";
import { PitecoHeroAssetBridge } from "@/components/layout/PitecoHeroAssetBridge";
import { usePalette } from "@/hooks/usePalette";
import { usePerformance } from "@/contexts/PerformanceContext";
import "@/styles/space-layouts.css";

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
  { left: "7%", top: "14%", size: 3, duration: 5200, delay: -150, glow: "rgba(255,255,255,.92)" },
  { left: "38%", top: "81%", size: 2, duration: 6100, delay: -800, glow: "rgba(224,196,255,.9)" },
  { left: "75%", top: "27%", size: 2, duration: 5800, delay: -450, glow: "rgba(255,255,255,.9)" },
  { left: "18%", top: "66%", size: 2, duration: 6600, delay: -1050, glow: "rgba(255,255,255,.86)" },
  { left: "57%", top: "53%", size: 3, duration: 6300, delay: -1450, glow: "rgba(195,225,255,.9)" },
  { left: "90%", top: "58%", size: 2, duration: 7000, delay: -1900, glow: "rgba(235,202,255,.88)" },
  { left: "28%", top: "34%", size: 2, duration: 7400, delay: -2100, glow: "rgba(205,228,255,.84)" },
  { left: "82%", top: "86%", size: 2, duration: 6800, delay: -2600, glow: "rgba(255,255,255,.84)" },
];

const MOBILE_QUERY = "(max-width: 767px), (update: slow)";

export function SpaceTwinkleLayer() {
  const { palette } = usePalette();
  const { settings } = usePerformance();
  const shootingStarRef = useRef<HTMLSpanElement>(null);
  const [mobileLite, setMobileLite] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );
  const isGalaxy = palette === "galaxy";
  const starMotionAllowed = settings.animations && !settings.reduceMotion && settings.decorativeEffects && !mobileLite;
  const shootingStarAllowed = settings.animations && !settings.reduceMotion;
  const visibleStars = mobileLite ? STARS.slice(0, 5) : STARS;

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const sync = () => setMobileLite(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    if (!isGalaxy || !shootingStarAllowed) return;
    const star = shootingStarRef.current;
    if (!star || typeof star.animate !== "function") return;

    let timer: number | undefined;
    let cancelled = false;

    const schedule = (first = false) => {
      if (cancelled) return;
      const min = first ? (mobileLite ? 30000 : 20000) : (mobileLite ? 65000 : 45000);
      const variation = first ? (mobileLite ? 20000 : 15000) : (mobileLite ? 35000 : 30000);
      timer = window.setTimeout(run, min + Math.random() * variation);
    };

    const run = () => {
      if (cancelled) return;
      if (document.hidden) {
        schedule();
        return;
      }
      star.style.top = `${8 + Math.random() * 40}%`;
      star.style.left = "-12rem";
      const animation = star.animate(
        [
          { opacity: 0, transform: "translate3d(0,0,0) rotate(-24deg)" },
          { opacity: .92, offset: .14 },
          { opacity: .72, offset: .72 },
          { opacity: 0, transform: "translate3d(140vw,52vh,0) rotate(-24deg)" },
        ],
        { duration: mobileLite ? 1700 : 1450, easing: "cubic-bezier(.2,.65,.35,1)" },
      );
      animation.finished.catch(() => undefined).finally(() => schedule());
    };

    schedule(true);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [isGalaxy, shootingStarAllowed, mobileLite]);

  return (
    <Fragment>
      <style>{DRAWER_LAYOUT_CSS}</style>
      <PitecoHeroAssetBridge />
      {isGalaxy && (
        <div aria-hidden="true" className="space-galaxy-effects">
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
                boxShadow: `0 0 ${star.size * 3}px ${star.size}px ${star.glow}`,
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
