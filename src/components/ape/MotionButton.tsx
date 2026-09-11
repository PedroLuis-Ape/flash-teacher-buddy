import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Presentation-only button surface for primary actions.
 * Behavior, disabled state, keyboard semantics, and event handlers stay native.
 */
export const MotionButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, type = "button", ...props }, ref) => (
    <button
      {...props}
      ref={ref}
      type={type}
      className={cn("ape-motion-button", className)}
    />
  ),
);

MotionButton.displayName = "MotionButton";
