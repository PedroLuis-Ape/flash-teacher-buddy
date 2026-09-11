import { useEffect, useRef, type RefObject } from "react";

export type DOMRectLike = Pick<DOMRect, "left" | "top" | "width" | "height">;

export interface PointerTiltOptions {
  maxTilt?: number;
  disabled?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculatePointerTilt(
  rect: DOMRectLike,
  clientX: number,
  clientY: number,
  maxTilt = 3,
) {
  const x = clamp((clientX - rect.left) / (rect.width || 1), 0, 1);
  const y = clamp((clientY - rect.top) / (rect.height || 1), 0, 1);

  return {
    tiltX: Number(((0.5 - y) * maxTilt * 2).toFixed(3)),
    tiltY: Number(((x - 0.5) * maxTilt * 2).toFixed(3)),
    pointerX: Number((x * 100).toFixed(2)),
    pointerY: Number((y * 100).toFixed(2)),
  };
}

function setMotionValue(node: HTMLElement, name: string, value: number | string): void {
  node.style.setProperty(name, typeof value === "number" ? `${value}` : value);
}

export function usePointerTilt<T extends HTMLElement>(
  { maxTilt = 3, disabled = false }: PointerTiltOptions = {},
): RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || disabled || typeof window === "undefined") return;

    const supportsFinePointer = window.matchMedia?.("(pointer: fine)").matches ?? false;
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!supportsFinePointer || prefersReducedMotion) return;

    let frame = 0;
    const cancelFrame = () => {
      if (!frame) return;
      window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const reset = () => {
      cancelFrame();
      frame = window.requestAnimationFrame(() => {
        setMotionValue(node, "--ape-motion-tilt-x", "0deg");
        setMotionValue(node, "--ape-motion-tilt-y", "0deg");
        setMotionValue(node, "--ape-motion-pointer-x", "50%");
        setMotionValue(node, "--ape-motion-pointer-y", "50%");
        frame = 0;
      });
    };
    const handlePointerMove = (event: PointerEvent) => {
      cancelFrame();
      const values = calculatePointerTilt(node.getBoundingClientRect(), event.clientX, event.clientY, maxTilt);
      frame = window.requestAnimationFrame(() => {
        setMotionValue(node, "--ape-motion-tilt-x", `${values.tiltX}deg`);
        setMotionValue(node, "--ape-motion-tilt-y", `${values.tiltY}deg`);
        setMotionValue(node, "--ape-motion-pointer-x", `${values.pointerX}%`);
        setMotionValue(node, "--ape-motion-pointer-y", `${values.pointerY}%`);
        frame = 0;
      });
    };

    node.addEventListener("pointermove", handlePointerMove, { passive: true });
    node.addEventListener("pointerleave", reset, { passive: true });

    return () => {
      cancelFrame();
      node.removeEventListener("pointermove", handlePointerMove);
      node.removeEventListener("pointerleave", reset);
    };
  }, [disabled, maxTilt]);

  return ref;
}
