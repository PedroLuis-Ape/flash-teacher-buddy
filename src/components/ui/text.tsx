import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const textVariants = cva("ape-text-primitive", {
  variants: {
    tone: {
      primary: "text-content-primary",
      secondary: "text-content-secondary",
      supporting: "text-content-supporting",
      disabled: "text-content-disabled",
    },
    size: {
      xs: "text-xs leading-relaxed",
      sm: "text-sm leading-relaxed",
      md: "text-base leading-relaxed",
      lg: "text-lg leading-relaxed",
      display: "text-2xl font-black leading-tight tracking-tight sm:text-3xl",
    },
    weight: {
      regular: "font-normal",
      medium: "font-medium",
      strong: "font-bold",
      expressive: "font-black",
    },
  },
  defaultVariants: {
    tone: "primary",
    size: "md",
    weight: "regular",
  },
});

type TextElement = "p" | "span" | "div" | "label";

export interface TextProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof textVariants> {
  as?: TextElement;
}

const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ as: Comp = "p", className, tone, size, weight, ...props }, ref) => (
    <Comp
      ref={ref as never}
      className={cn(textVariants({ tone, size, weight }), className)}
      data-ape-ui="text"
      data-ape-tone={tone ?? "primary"}
      {...props}
    />
  ),
);
Text.displayName = "Text";

export { Text };
