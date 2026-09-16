import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FINE_POINTER_QUERY = "(pointer: fine)";
const DESKTOP_QUERY = "(min-width: 761px)";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function subscribeMediaQuery(query: MediaQueryList, callback: () => void) {
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", callback);
    return () => query.removeEventListener("change", callback);
  }

  query.addListener(callback);
  return () => query.removeListener(callback);
}

export function useReducedMotionPreference(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const sync = () => setReduced(query.matches);
    sync();
    return subscribeMediaQuery(query, sync);
  }, []);

  return reduced;
}

interface MotionRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Progressive-enhancement reveal. Content is visible in the server/static DOM;
 * it is only staged after IntersectionObserver is attached in the browser.
 */
export function MotionReveal({ children, className = "", delay = 0 }: MotionRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotionPreference();
  const [enabled, setEnabled] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      setEnabled(false);
      setInView(true);
      return;
    }

    setEnabled(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setInView(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -9% 0px", threshold: 0.12 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div
      ref={ref}
      className={`landing-motion-reveal ${className}`.trim()}
      data-motion-enabled={enabled ? "true" : "false"}
      data-in-view={inView ? "true" : "false"}
      style={{ "--landing-reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function useLandingPointerGlow<T extends HTMLElement>(disabled = false) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || disabled || typeof window === "undefined" || !window.matchMedia) return;

    const finePointer = window.matchMedia(FINE_POINTER_QUERY);
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY);
    if (!finePointer.matches || !desktop.matches || reduced.matches) return;

    let frame = 0;
    const update = (event: PointerEvent) => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const x = clamp(((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100, 0, 100);
        const y = clamp(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100, 0, 100);
        node.style.setProperty("--landing-pointer-x", `${x.toFixed(2)}%`);
        node.style.setProperty("--landing-pointer-y", `${y.toFixed(2)}%`);
        frame = 0;
      });
    };

    node.addEventListener("pointermove", update, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", update);
    };
  }, [disabled]);

  return ref;
}

export function useMagneticMotion<T extends HTMLElement>(disabled = false, strength = 7) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || disabled || typeof window === "undefined" || !window.matchMedia) return;

    const finePointer = window.matchMedia(FINE_POINTER_QUERY);
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY);
    if (!finePointer.matches || reduced.matches) return;

    let frame = 0;
    const reset = () => {
      node.style.setProperty("--landing-magnet-x", "0px");
      node.style.setProperty("--landing-magnet-y", "0px");
    };
    const update = (event: PointerEvent) => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const x = clamp((event.clientX - (rect.left + rect.width / 2)) / Math.max(rect.width / 2, 1), -1, 1);
        const y = clamp((event.clientY - (rect.top + rect.height / 2)) / Math.max(rect.height / 2, 1), -1, 1);
        node.style.setProperty("--landing-magnet-x", `${(x * strength).toFixed(2)}px`);
        node.style.setProperty("--landing-magnet-y", `${(y * strength * 0.65).toFixed(2)}px`);
        frame = 0;
      });
    };

    node.addEventListener("pointermove", update, { passive: true });
    node.addEventListener("pointerleave", reset, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", update);
      node.removeEventListener("pointerleave", reset);
    };
  }, [disabled, strength]);

  return ref;
}

export function useHeroScrollMotion<T extends HTMLElement>(disabled = false) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || disabled || typeof window === "undefined") return;

    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const progress = clamp(-rect.top / Math.max(rect.height * 0.82, 1), 0, 1);
        node.style.setProperty("--landing-hero-progress", progress.toFixed(4));
        frame = 0;
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [disabled]);

  return ref;
}

export function useLandingStoryProgress<T extends HTMLElement>(stepCount: number, disabled = false) {
  const ref = useRef<T>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node || disabled || typeof window === "undefined") {
      setActiveStep(0);
      return;
    }

    let frame = 0;
    let currentStep = -1;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const viewport = window.innerHeight || 1;
        const start = viewport * 0.68;
        const travel = Math.max(rect.height - viewport * 0.42, 1);
        const progress = clamp((start - rect.top) / travel, 0, 1);
        node.style.setProperty("--landing-story-progress", progress.toFixed(4));

        const nextStep = Math.min(
          Math.max(stepCount - 1, 0),
          Math.floor(progress * Math.max(stepCount, 1)),
        );
        if (nextStep !== currentStep) {
          currentStep = nextStep;
          setActiveStep(nextStep);
        }
        frame = 0;
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [disabled, stepCount]);

  return { ref, activeStep };
}
