import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const surfaceVariants = cva("ape-surface-primitive", {
  variants: {
    surface: {
      base: "bg-surface-base",
      raised: "bg-surface-raised shadow-play-raised",
      sunken: "bg-surface-sunken",
      overlay: "bg-surface-overlay shadow-play-overlay",
    },
    density: {
      compact: "p-3",
      work: "p-4",
      play: "p-5 sm:p-6",
    },
  },
  defaultVariants: {
    surface: "base",
    density: "work",
  },
});

type SurfaceElement = "div" | "section" | "article" | "aside";

export interface SurfaceProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof surfaceVariants> {
  as?: SurfaceElement;
}

const Surface = React.forwardRef<HTMLElement, SurfaceProps>(
  ({ as: Comp = "div", className, surface, density, ...props }, ref) => (
    <Comp
      ref={ref as never}
      className={cn(surfaceVariants({ surface, density }), className)}
      data-ape-ui="surface"
      data-ape-surface={surface ?? "base"}
      data-ape-density={density ?? "work"}
      {...props}
    />
  ),
);
Surface.displayName = "Surface";

export { Surface };
