import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: ReactNode;
  className?: string;
  /** Max width preset. Default: "5xl". */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "5xl" | "6xl" | "7xl";
  /** Vertical spacing between top-level children. Default: "md". */
  spacing?: "none" | "sm" | "md" | "lg";
  /** Adds top padding (after sticky header). Default: true. */
  padded?: boolean;
}

const MAX_WIDTH_MAP: Record<NonNullable<PageShellProps["maxWidth"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

const SPACING_MAP: Record<NonNullable<PageShellProps["spacing"]>, string> = {
  none: "",
  sm: "space-y-3",
  md: "space-y-6",
  lg: "space-y-8",
};

/**
 * Standard page container — provides consistent horizontal padding,
 * max-width, and vertical rhythm. Mobile-first (px-4 → sm:px-6 → lg:px-8).
 * Use inside pages to keep alignment uniform across the app.
 */
export function PageShell({
  children,
  className,
  maxWidth = "5xl",
  spacing = "md",
  padded = true,
}: PageShellProps) {
  return (
    <div
      className={cn(
        "w-full mx-auto px-4 sm:px-6 lg:px-8",
        MAX_WIDTH_MAP[maxWidth],
        SPACING_MAP[spacing],
        padded && "pt-4 pb-24",
        className
      )}
    >
      {children}
    </div>
  );
}
