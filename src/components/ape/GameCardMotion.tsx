import { forwardRef, type ButtonHTMLAttributes, type Ref } from "react";
import { cn } from "@/lib/utils";
import { usePointerTilt } from "@/hooks/usePointerTilt";

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    (ref as { current: T | null }).current = value;
  }
}

export const GameCardMotion = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, forwardedRef) => {
    const motionRef = usePointerTilt<HTMLButtonElement>({ maxTilt: 3 });

    return (
      <button
        {...props}
        ref={(node) => {
          motionRef.current = node;
          assignRef(forwardedRef, node);
        }}
        type="button"
        data-motion-surface="game-card"
        className={cn("ape-game-card-motion", className)}
      >
        {children}
      </button>
    );
  },
);

GameCardMotion.displayName = "GameCardMotion";
